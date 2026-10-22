import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AddFriendDto } from './dto/add-friend.dto';
import { PresenceGateway } from './presence.gateway';
import { normalizeUsername } from '../users/username';
import { NotificationsService } from '../notifications/notifications.service';

const MAX_INT = 2147483647;

export type FriendUser = {
  userId: number;
  username: string;
  name: string | null;
  avatarUrl: string | null;
};

export type Friend = FriendUser & { online: boolean };

export type FriendList = {
  friends: Friend[];
  incoming: FriendUser[];
  outgoing: FriendUser[];
};

const person = {
  select: {
    id: true,
    username: true,
    name: true,
    avatarUrl: true,
    appearOffline: true,
  },
} as const;

function between(userId: number, otherId: number) {
  return {
    OR: [
      { requesterId: userId, addresseeId: otherId },
      { requesterId: otherId, addresseeId: userId },
    ],
  };
}

@Injectable()
export class FriendsService {
  constructor(
    private prisma: PrismaService,
    private presence: PresenceGateway,
    private notifications: NotificationsService,
  ) {}

  async list(userId: number): Promise<FriendList> {
    const friendships = await this.prisma.friendship.findMany({
      where: { OR: [{ requesterId: userId }, { addresseeId: userId }] },
      orderBy: { createdAt: 'desc' },
      include: { requester: person, addressee: person },
    });
    const list: FriendList = { friends: [], incoming: [], outgoing: [] };

    for (const friendship of friendships) {
      const other =
        friendship.requesterId === userId
          ? friendship.addressee
          : friendship.requester;
      const user = {
        userId: other.id,
        username: other.username,
        name: other.name,
        avatarUrl: other.avatarUrl,
      };

      if (friendship.status === 'accepted') {
        list.friends.push({
          ...user,
          online: !other.appearOffline && this.presence.isOnline(other.id),
        });
      } else if (friendship.addresseeId === userId) {
        list.incoming.push(user);
      } else {
        list.outgoing.push(user);
      }
    }

    list.friends.sort((a, b) =>
      (a.name ?? a.username).localeCompare(b.name ?? b.username),
    );
    return list;
  }

  async add(userId: number, { userId: targetId, username }: AddFriendDto) {
    const target = await this.prisma.user.findUnique({
      where:
        targetId !== undefined
          ? { id: targetId }
          : { username: normalizeUsername(username!) },
      select: { id: true },
    });

    if (!target) throw new NotFoundException('User not found');
    if (target.id === userId) {
      throw new BadRequestException('You cannot add yourself');
    }

    const existing = await this.prisma.friendship.findFirst({
      where: between(userId, target.id),
    });

    if (existing?.status === 'accepted') {
      throw new ConflictException('You are already friends');
    }
    if (existing?.requesterId === userId) {
      throw new ConflictException('Friend request already sent');
    }

    if (existing) {
      await this.prisma.friendship.update({
        where: {
          requesterId_addresseeId: {
            requesterId: target.id,
            addresseeId: userId,
          },
        },
        data: { status: 'accepted' },
      });
      await this.notifications.notify([
        {
          userId: target.id,
          actorId: userId,
          type: 'friend_accepted',
          message: 'accepted your friend request',
          link: '/',
        },
      ]);
    } else {
      await this.prisma.friendship.create({
        data: { requesterId: userId, addresseeId: target.id },
      });
      await this.notifications.notify([
        {
          userId: target.id,
          actorId: userId,
          type: 'friend_request',
          message: 'sent you a friend request',
          link: '/',
        },
      ]);
    }

    this.presence.notify([userId, target.id], 'friends:changed');
  }

  async remove(userId: number, otherId: number) {
    const { count } =
      otherId >= 1 && otherId <= MAX_INT
        ? await this.prisma.friendship.deleteMany({
            where: between(userId, otherId),
          })
        : { count: 0 };

    if (count === 0) throw new NotFoundException('Friend not found');
    this.presence.notify([userId, otherId], 'friends:changed');
  }
}
