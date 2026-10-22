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
import { StorageService } from '../storage/storage.service';
import { PresenceGateway } from '../friends/presence.gateway';

export type CommunityMember = {
  userId: number;
  username: string;
  name: string | null;
  avatarUrl: string | null;
  online: boolean;
  nickname: string | null;
  joinedAt: Date;
  isOwner: boolean;
  isAdmin: boolean;
};

export type CommunityWithRole = CommunityModel & {
  role: CommunityRole;
  memberCount?: number;
};

const roleRank: Record<CommunityRole, number> = {
  owner: 0,
  admin: 1,
  member: 2,
};

const communityImages = {
  icon: { field: 'iconUrl', folder: 'communities', maxSize: 512 },
  cover: { field: 'coverUrl', folder: 'covers', maxSize: 1600 },
  background: { field: 'backgroundUrl', folder: 'backgrounds', maxSize: 1920 },
} as const;

export type CommunityImage = keyof typeof communityImages;

export type CommunitySearchResult = {
  id: number;
  name: string;
  iconUrl: string | null;
  coverUrl: string | null;
  memberCount: number;
  joined: boolean;
};

@Injectable()
export class CommunitiesService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private presence: PresenceGateway,
  ) {}

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
        iconUrl: true,
        coverUrl: true,
        _count: { select: { memberships: true } },
        memberships: { where: { userId }, select: { userId: true } },
      },
    });

    return communities.map(
      ({ id, name, iconUrl, coverUrl, _count, memberships }) => ({
        id,
        name,
        iconUrl,
        coverUrl,
        memberCount: _count.memberships,
        joined: memberships.length > 0,
      }),
    );
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
            user: {
              select: {
                id: true,
                username: true,
                name: true,
                avatarUrl: true,
                appearOffline: true,
              },
            },
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
          avatarUrl: user.avatarUrl,
          online: !user.appearOffline && this.presence.isOnline(user.id),
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
      this.prisma.community.findUnique({
        where: { id },
        include: { _count: { select: { memberships: true } } },
      }),
      this.roleOf(userId, id),
    ]);
    if (!community || !role) return null;

    const { _count, ...rest } = community;
    return { ...rest, role, memberCount: _count.memberships };
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

  async updateImage(
    userId: number,
    communityId: number,
    image: CommunityImage,
    file: Buffer,
  ): Promise<CommunityWithRole> {
    await this.requireRole(userId, communityId, 'admin');
    const { folder, maxSize } = communityImages[image];
    const { url } = await this.storage.uploadImage(file, folder, maxSize);
    return this.replaceImage(userId, communityId, image, url);
  }

  async removeImage(
    userId: number,
    communityId: number,
    image: CommunityImage,
  ): Promise<CommunityWithRole> {
    await this.requireRole(userId, communityId, 'admin');
    return this.replaceImage(userId, communityId, image, null);
  }

  async remove(userId: number, communityId: number): Promise<void> {
    await this.requireRole(userId, communityId, 'owner');
    const community = await this.prisma.community.delete({
      where: { id: communityId },
    });
    await this.deleteStoredImage(community.iconUrl);
    await this.deleteStoredImage(community.coverUrl);
    await this.deleteStoredImage(community.backgroundUrl);
  }

  private async replaceImage(
    userId: number,
    communityId: number,
    image: CommunityImage,
    url: string | null,
  ): Promise<CommunityWithRole> {
    const { field } = communityImages[image];
    const previous = await this.prisma.community.findUnique({
      where: { id: communityId },
      select: { iconUrl: true, coverUrl: true, backgroundUrl: true },
    });
    await this.prisma.community.update({
      where: { id: communityId },
      data: { [field]: url },
    });
    await this.deleteStoredImage(previous?.[field] ?? null);

    return (await this.findOne(userId, communityId))!;
  }

  private async deleteStoredImage(url: string | null) {
    const key = url && this.storage.keyFor(url);
    if (key) await this.storage.delete(key).catch(() => {});
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
