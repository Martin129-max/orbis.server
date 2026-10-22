import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { VotableType } from '../../prisma/generated/client';
import { requirePostAccess } from '../posts/wall-access';
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

  private async homeOf(
    type: VoteDto['type'],
    id: number,
  ): Promise<{ communityId: number | null; wallUserId: number | null }> {
    if (type === 'thread') {
      const thread = await this.prisma.thread.findUnique({
        where: { id },
        select: { communityId: true },
      });
      if (!thread) throw new NotFoundException('Not found');
      return { communityId: thread.communityId, wallUserId: null };
    }

    const comment = await this.prisma.comment.findUnique({
      where: { id },
      select: { communityId: true, commentableId: true },
    });
    if (!comment) throw new NotFoundException('Not found');
    if (comment.communityId !== null) {
      return { communityId: comment.communityId, wallUserId: null };
    }

    const post = await this.prisma.post.findUnique({
      where: { id: comment.commentableId },
      select: { wallUserId: true },
    });
    return { communityId: null, wallUserId: post?.wallUserId ?? null };
  }

  async vote(
    userId: number,
    { type, id, value }: VoteDto,
  ): Promise<VoteResult> {
    const home = await this.homeOf(type, id);
    await requirePostAccess(this.prisma, userId, home);

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
            communityId: home.communityId,
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
