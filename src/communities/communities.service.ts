import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateCommunityDto } from './dto/create-community.dto';
import { ReorderCommunitiesDto } from './dto/reorder-communities.dto';
import { Community as CommunityModel } from '../../prisma/generated/client';

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

  findOne(id: number): Promise<CommunityModel | null> {
    return this.prisma.community.findUnique({ where: { id } });
  }
}
