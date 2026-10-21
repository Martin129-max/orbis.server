import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateCommunityDto } from './dto/create-community.dto';
import { ReorderCommunitiesDto } from './dto/reorder-communities.dto';
import { SearchCommunitiesDto } from './dto/search-communities.dto';
import { MAX_INT } from './community-member.guard';
import { Community as CommunityModel } from '../../prisma/generated/client';

export type CommunityMember = {
  userId: number;
  email: string;
  name: string | null;
  nickname: string | null;
  joinedAt: Date;
  isOwner: boolean;
};

export type CommunitySearchResult = {
  id: number;
  name: string;
  memberCount: number;
  joined: boolean;
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
        isPublic: createCommunityDto.isPublic ?? false,
        ownerId,
        memberships: { create: { userId: ownerId, position } },
      },
    });
  }

  async search(
    userId: number,
    { q }: SearchCommunitiesDto,
  ): Promise<CommunitySearchResult[]> {
    const query = q?.trim();
    const communities = await this.prisma.community.findMany({
      where: {
        isPublic: true,
        ...(query && { name: { contains: query, mode: 'insensitive' } }),
      },
      orderBy: [{ memberships: { _count: 'desc' } }, { createdAt: 'desc' }],
      take: 20,
      select: {
        id: true,
        name: true,
        _count: { select: { memberships: true } },
        memberships: { where: { userId }, select: { userId: true } },
      },
    });

    return communities.map(({ id, name, _count, memberships }) => ({
      id,
      name,
      memberCount: _count.memberships,
      joined: memberships.length > 0,
    }));
  }

  async join(userId: number, communityId: number): Promise<CommunityModel> {
    const community =
      communityId >= 1 && communityId <= MAX_INT
        ? await this.prisma.community.findUnique({ where: { id: communityId } })
        : null;

    if (!community?.isPublic) {
      throw new NotFoundException('Community not found');
    }

    const position = await this.prisma.membership.count({
      where: { userId },
    });
    await this.prisma.membership.upsert({
      where: { userId_communityId: { userId, communityId } },
      create: { userId, communityId, position },
      update: {},
    });

    return community;
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
