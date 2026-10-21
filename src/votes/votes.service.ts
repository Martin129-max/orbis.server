import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { VotableType } from '../../prisma/generated/client';
import { requireMembership } from '../communities/require-membership';
import { VoteDto } from './dto/vote.dto';

export type VoteResult = { score: number; myVote: number };

@Injectable()
export class VotesService {
  constructor(private prisma: PrismaService) {}

  async myVotes(
    userId: number,
    votableType: VotableType,
    ids: number[],
  ): Promise<Map<number, number>> {
    if (ids.length === 0) return new Map();

    const votes = await this.prisma.vote.findMany({
      where: { userId, votableType, votableId: { in: ids } },
      select: { votableId: true, value: true },
    });
    return new Map(votes.map(({ votableId, value }) => [votableId, value]));
  }

  async vote(
    userId: number,
    { type, id, value }: VoteDto,
  ): Promise<VoteResult> {
    const target =
      type === 'thread'
        ? await this.prisma.thread.findUnique({
            where: { id },
            select: { communityId: true },
          })
        : await this.prisma.comment.findUnique({
            where: { id },
            select: { communityId: true },
          });

    if (!target) throw new NotFoundException('Not found');
    await requireMembership(this.prisma, userId, target.communityId);

    return this.prisma.$transaction(async (tx) => {
      const key = {
        userId_votableType_votableId: {
          userId,
          votableType: type,
          votableId: id,
        },
      };
      const existing = await tx.vote.findUnique({ where: key });
      const delta = value - (existing?.value ?? 0);

      if (value === 0) {
        if (existing) await tx.vote.delete({ where: key });
      } else {
        await tx.vote.upsert({
          where: key,
          create: {
            userId,
            votableType: type,
            votableId: id,
            communityId: target.communityId,
            value,
          },
          update: { value },
        });
      }

      const data = { score: { increment: delta } };
      const select = { score: true } as const;
      const { score } =
        type === 'thread'
          ? await tx.thread.update({ where: { id }, data, select })
          : await tx.comment.update({ where: { id }, data, select });

      return { score, myVote: value };
    });
  }
}
