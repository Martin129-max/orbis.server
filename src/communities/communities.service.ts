import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateCommunityDto } from './dto/create-community.dto';
import { ReorderCommunitiesDto } from './dto/reorder-communities.dto';
import { Community as CommunityModel } from '../../prisma/generated/client';

export type CommunityMember = {
  userId: number;
  email: string;
  name: string | null;
  nickname: string | null;
  joinedAt: Date;
  isOwner: boolean;
};

@Injectable()
export class CommunitiesService {
  constructor(private prisma: PrismaService) {}

  async create(
    ownerId: number,
    createCommunityDto: CreateCommunityDto,
  ): Promise<CommunityModel> {
    const position = await this.prisma.membership.count({
      where: { userId: ownerId },
    });

    return this.prisma.community.create({
      data: {
        name: createCommunityDto.name.trim(),
        ownerId,
        memberships: { create: { userId: ownerId, position } },
      },
    });
  }

  async findForMember(userId: number): Promise<CommunityModel[]> {
    const memberships = await this.prisma.membership.findMany({
      where: { userId },
      orderBy: [{ position: 'asc' }, { joinedAt: 'asc' }],
      include: { community: true },
    });

    return memberships.map(({ community }) => community);
  }

  async reorder(
    userId: number,
    { communityIds }: ReorderCommunitiesDto,
  ): Promise<CommunityModel[]> {
    const memberships = await this.prisma.membership.findMany({
      where: { userId },
      select: { communityId: true },
    });
    const memberOf = new Set(memberships.map(({ communityId }) => communityId));

    if (
      communityIds.length !== memberOf.size ||
      new Set(communityIds).size !== communityIds.length ||
      communityIds.some((id) => !memberOf.has(id))
    ) {
      throw new BadRequestException(
        'communityIds must list each of your communities exactly once',
      );
    }

    await this.prisma.$transaction(
      communityIds.map((communityId, position) =>
        this.prisma.membership.update({
          where: { userId_communityId: { userId, communityId } },
          data: { position },
        }),
      ),
    );

    return this.findForMember(userId);
  }

  async findMembers(communityId: number): Promise<CommunityMember[]> {
    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
      select: {
        ownerId: true,
        memberships: {
          orderBy: { joinedAt: 'asc' },
          select: {
            nickname: true,
            joinedAt: true,
            user: { select: { id: true, email: true, name: true } },
          },
        },
      },
    });

    if (!community) return [];

    return community.memberships
      .map(({ nickname, joinedAt, user }) => ({
        userId: user.id,
        email: user.email,
        name: user.name,
        nickname,
        joinedAt,
        isOwner: user.id === community.ownerId,
      }))
      .sort((a, b) => Number(b.isOwner) - Number(a.isOwner));
  }

  findOne(id: number): Promise<CommunityModel | null> {
    return this.prisma.community.findUnique({ where: { id } });
  }
}
