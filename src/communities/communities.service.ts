import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateCommunityDto } from './dto/create-community.dto';
import { ReorderCommunitiesDto } from './dto/reorder-communities.dto';
import { SearchCommunitiesDto } from './dto/search-communities.dto';
import { UpdateCommunityDto } from './dto/update-community.dto';
import { ADMINISTRATOR, CommunityRole, isAdministrator } from './permissions';
import { MAX_INT } from './community-member.guard';
import { Community as CommunityModel } from '../../prisma/generated/client';

export type CommunityMember = {
  userId: number;
  username: string;
  name: string | null;
  nickname: string | null;
  joinedAt: Date;
  isOwner: boolean;
  isAdmin: boolean;
};

export type CommunityWithRole = CommunityModel & { role: CommunityRole };

const roleRank: Record<CommunityRole, number> = {
  owner: 0,
  admin: 1,
  member: 2,
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
            user: { select: { id: true, username: true, name: true } },
            roles: { select: { role: { select: { permissions: true } } } },
          },
        },
      },
    });

    if (!community) return [];

    return community.memberships
      .map(({ nickname, joinedAt, user, roles }) => {
        const isOwner = user.id === community.ownerId;
        return {
          userId: user.id,
          username: user.username,
          name: user.name,
          nickname,
          joinedAt,
          isOwner,
          isAdmin:
            !isOwner &&
            roles.some(({ role }) => isAdministrator(role.permissions)),
        };
      })
      .sort(
        (a, b) =>
          roleRank[a.isOwner ? 'owner' : a.isAdmin ? 'admin' : 'member'] -
          roleRank[b.isOwner ? 'owner' : b.isAdmin ? 'admin' : 'member'],
      );
  }

  async findOne(userId: number, id: number): Promise<CommunityWithRole | null> {
    const [community, role] = await Promise.all([
      this.prisma.community.findUnique({ where: { id } }),
      this.roleOf(userId, id),
    ]);

    return community && role && { ...community, role };
  }

  async roleOf(
    userId: number,
    communityId: number,
  ): Promise<CommunityRole | null> {
    const membership = await this.prisma.membership.findUnique({
      where: { userId_communityId: { userId, communityId } },
      select: {
        community: { select: { ownerId: true } },
        roles: { select: { role: { select: { permissions: true } } } },
      },
    });

    if (!membership) return null;
    if (membership.community.ownerId === userId) return 'owner';
    return membership.roles.some(({ role }) =>
      isAdministrator(role.permissions),
    )
      ? 'admin'
      : 'member';
  }

  private async requireRole(
    userId: number,
    communityId: number,
    required: 'owner' | 'admin',
  ) {
    const role = await this.roleOf(userId, communityId);
    if (!role || roleRank[role] > roleRank[required]) {
      throw new ForbiddenException(
        required === 'owner'
          ? 'Only the owner can do this'
          : 'Only admins can do this',
      );
    }
    return role;
  }

  async update(
    userId: number,
    communityId: number,
    { name, isPublic }: UpdateCommunityDto,
  ): Promise<CommunityWithRole> {
    const role = await this.requireRole(userId, communityId, 'admin');
    const community = await this.prisma.community.update({
      where: { id: communityId },
      data: { name: name?.trim(), isPublic },
    });

    return { ...community, role };
  }

  async remove(userId: number, communityId: number): Promise<void> {
    await this.requireRole(userId, communityId, 'owner');
    await this.prisma.community.delete({ where: { id: communityId } });
  }

  async setAdmin(
    userId: number,
    communityId: number,
    targetId: number,
    isAdmin: boolean,
  ): Promise<CommunityMember[]> {
    await this.requireRole(userId, communityId, 'owner');

    const targetRole =
      targetId >= 1 && targetId <= MAX_INT
        ? await this.roleOf(targetId, communityId)
        : null;
    if (!targetRole) throw new NotFoundException('Member not found');
    if (targetRole === 'owner') {
      throw new BadRequestException('The owner is always an admin');
    }

    const adminRoleIds = (
      await this.prisma.role.findMany({
        where: { communityId },
        select: { id: true, permissions: true },
      })
    )
      .filter(({ permissions }) => isAdministrator(permissions))
      .map(({ id }) => id);

    if (isAdmin) {
      const roleId =
        adminRoleIds[0] ??
        (
          await this.prisma.role.create({
            data: { communityId, name: 'Admin', permissions: ADMINISTRATOR },
          })
        ).id;
      await this.prisma.membershipRole.upsert({
        where: {
          userId_communityId_roleId: { userId: targetId, communityId, roleId },
        },
        create: { userId: targetId, communityId, roleId },
        update: {},
      });
    } else {
      await this.prisma.membershipRole.deleteMany({
        where: { userId: targetId, communityId, roleId: { in: adminRoleIds } },
      });
    }

    return this.findMembers(communityId);
  }
}
