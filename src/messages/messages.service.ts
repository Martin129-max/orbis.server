import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConversationStatus, Prisma } from '../../prisma/generated/client';
import { PrismaService } from '../prisma.service';
import { MAX_INT } from '../communities/community-member.guard';
import { PresenceGateway } from '../friends/presence.gateway';
import { MESSAGE_LIMIT, MESSAGE_PAGE_SIZE, pair } from './conversation';

const person = {
  select: { id: true, username: true, name: true, avatarUrl: true },
} as const;

type Person = {
  id: number;
  username: string;
  name: string | null;
  avatarUrl: string | null;
};

type Summary = {
  lastText: string;
  lastSenderId: number | null;
  lastMessageAt: Date;
};

type MemberState = { unread: number; status: ConversationStatus };

export type ChatMessage = {
  id: number;
  senderId: number;
  text: string;
  sentAt: string;
};

export type InboxEntry = {
  userId: number;
  username: string;
  name: string | null;
  avatarUrl: string | null;
  lastText: string;
  lastSenderId: number | null;
  lastAt: string;
  unread: number;
  status: ConversationStatus;
};

export type Thread = {
  messages: ChatMessage[];
  seenAt: string | null;
  hasMore: boolean;
};

function toMessage(message: {
  id: number;
  senderId: number;
  text: string;
  createdAt: Date;
}): ChatMessage {
  return {
    id: message.id,
    senderId: message.senderId,
    text: message.text,
    sentAt: message.createdAt.toISOString(),
  };
}

function toEntry(
  other: Person,
  { lastText, lastSenderId, lastMessageAt }: Summary,
  { unread, status }: MemberState,
): InboxEntry {
  return {
    userId: other.id,
    username: other.username,
    name: other.name,
    avatarUrl: other.avatarUrl,
    lastText,
    lastSenderId,
    lastAt: lastMessageAt.toISOString(),
    unread,
    status,
  };
}

function isUniqueViolation(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

@Injectable()
export class MessagesService {
  constructor(
    private prisma: PrismaService,
    private presence: PresenceGateway,
  ) {}

  async inbox(userId: number): Promise<InboxEntry[]> {
    const members = await this.prisma.conversationMember.findMany({
      where: { userId },
      orderBy: { conversation: { lastMessageAt: 'desc' } },
      select: {
        unread: true,
        status: true,
        conversation: {
          select: {
            lastText: true,
            lastSenderId: true,
            lastMessageAt: true,
            userA: person,
            userB: person,
          },
        },
      },
    });

    return members.map(
      ({ conversation: { userA, userB, ...summary }, ...state }) =>
        toEntry(userA.id === userId ? userB : userA, summary, state),
    );
  }

  async thread(
    userId: number,
    otherId: number,
    before?: number,
  ): Promise<Thread> {
    this.checkUserId(otherId);
    if (before !== undefined && (before < 1 || before > MAX_INT)) {
      throw new BadRequestException('Invalid cursor');
    }

    const conversation = await this.prisma.conversation.findUnique({
      where: { userAId_userBId: pair(userId, otherId) },
      select: { id: true, members: { select: { userId: true, readAt: true } } },
    });
    const members = conversation?.members ?? [];
    if (!conversation || !members.some((member) => member.userId === userId)) {
      return { messages: [], seenAt: null, hasMore: false };
    }

    const page = await this.prisma.message.findMany({
      where: {
        conversationId: conversation.id,
        ...(before !== undefined && { id: { lt: before } }),
      },
      orderBy: { id: 'desc' },
      take: MESSAGE_PAGE_SIZE + 1,
      select: { id: true, senderId: true, text: true, createdAt: true },
    });
    const seenAt = members.find((member) => member.userId === otherId)?.readAt;

    return {
      messages: page.slice(0, MESSAGE_PAGE_SIZE).reverse().map(toMessage),
      seenAt: seenAt?.toISOString() ?? null,
      hasMore: page.length > MESSAGE_PAGE_SIZE,
    };
  }

  async send(
    userId: number,
    otherId: number,
    content: string,
  ): Promise<ChatMessage> {
    const text = content.trim();
    if (!text) throw new BadRequestException('Message cannot be empty');
    if (otherId === userId) {
      throw new BadRequestException('You cannot message yourself');
    }
    this.checkUserId(otherId);

    const [me, other, friendship] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, ...person }),
      this.prisma.user.findUnique({ where: { id: otherId }, ...person }),
      this.prisma.friendship.findFirst({
        where: {
          status: 'accepted',
          OR: [
            { requesterId: userId, addresseeId: otherId },
            { requesterId: otherId, addresseeId: userId },
          ],
        },
        select: { requesterId: true },
      }),
    ]);
    if (!me || !other) throw new NotFoundException('User not found');

    const save = () => this.save(userId, otherId, text, friendship !== null);
    const { summary, message, mine, theirs } = await save().catch((error) => {
      if (isUniqueViolation(error)) return save();
      throw error;
    });

    const sent = toMessage(message);
    this.presence.notify([userId], 'message', {
      conversation: toEntry(other, summary, mine),
      message: sent,
    });
    this.presence.notify([otherId], 'message', {
      conversation: toEntry(me, summary, theirs),
      message: sent,
    });
    return sent;
  }

  async read(userId: number, otherId: number) {
    const member = await this.member(userId, otherId);
    if (!member) return;

    const readAt = new Date();
    const accepted = member.status === 'accepted';
    await this.prisma.conversationMember.update({
      where: {
        conversationId_userId: {
          conversationId: member.conversationId,
          userId,
        },
      },
      data: { unread: 0, ...(accepted && { readAt }) },
    });

    this.presence.notify([userId], 'conversation:changed', {
      userId: otherId,
      unread: 0,
    });
    if (accepted) {
      this.presence.notify([otherId], 'messages:read', {
        userId,
        readAt: readAt.toISOString(),
      });
    }
  }

  async accept(userId: number, otherId: number) {
    const member = await this.request(userId, otherId);
    await this.prisma.conversationMember.update({
      where: {
        conversationId_userId: {
          conversationId: member.conversationId,
          userId,
        },
      },
      data: { status: 'accepted' },
    });
    this.presence.notify([userId], 'conversation:changed', {
      userId: otherId,
      status: 'accepted',
    });
  }

  async decline(userId: number, otherId: number) {
    const member = await this.request(userId, otherId);
    await this.prisma.conversationMember.delete({
      where: {
        conversationId_userId: {
          conversationId: member.conversationId,
          userId,
        },
      },
    });
    this.presence.notify([userId], 'conversation:removed', { userId: otherId });
  }

  async typing(userId: number, otherId: number, typing: boolean) {
    const [mine, theirs] = await Promise.all([
      this.member(userId, otherId),
      this.member(otherId, userId),
    ]);
    if (!mine || theirs?.status !== 'accepted') return;
    this.presence.notify([otherId], 'typing', { userId, typing });
  }

  private save(
    userId: number,
    otherId: number,
    text: string,
    friends: boolean,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const { id: conversationId } = await tx.conversation.upsert({
        where: { userAId_userBId: pair(userId, otherId) },
        create: pair(userId, otherId),
        update: {},
        select: { id: true },
      });
      const existing = await tx.conversationMember.findUnique({
        where: { conversationId_userId: { conversationId, userId: otherId } },
        select: { status: true },
      });
      const status: ConversationStatus =
        friends || existing?.status === 'accepted' ? 'accepted' : 'request';
      const state = { unread: true, status: true } as const;

      const message = await tx.message.create({
        data: { conversationId, senderId: userId, text },
      });
      const summary = await tx.conversation.update({
        where: { id: conversationId },
        data: {
          lastText: text,
          lastSenderId: userId,
          lastMessageAt: message.createdAt,
        },
        select: { lastText: true, lastSenderId: true, lastMessageAt: true },
      });
      const mine = await tx.conversationMember.upsert({
        where: { conversationId_userId: { conversationId, userId } },
        create: { conversationId, userId, readAt: message.createdAt },
        update: { status: 'accepted', unread: 0, readAt: message.createdAt },
        select: state,
      });
      const theirs = await tx.conversationMember.upsert({
        where: { conversationId_userId: { conversationId, userId: otherId } },
        create: { conversationId, userId: otherId, status, unread: 1 },
        update: { status, unread: { increment: 1 } },
        select: state,
      });

      const cutoff = await tx.message.findFirst({
        where: { conversationId },
        orderBy: { id: 'desc' },
        skip: MESSAGE_LIMIT,
        select: { id: true },
      });
      if (cutoff) {
        await tx.message.deleteMany({
          where: { conversationId, id: { lte: cutoff.id } },
        });
      }

      return { summary, message, mine, theirs };
    });
  }

  private async member(userId: number, otherId: number) {
    if (otherId < 1 || otherId > MAX_INT || otherId === userId) return null;
    const conversation = await this.prisma.conversation.findUnique({
      where: { userAId_userBId: pair(userId, otherId) },
      select: {
        id: true,
        members: { where: { userId }, select: { status: true } },
      },
    });
    const member = conversation?.members[0];
    return member ? { conversationId: conversation.id, ...member } : null;
  }

  private async request(userId: number, otherId: number) {
    const member = await this.member(userId, otherId);
    if (member?.status !== 'request') {
      throw new NotFoundException('Message request not found');
    }
    return member;
  }

  private checkUserId(otherId: number) {
    if (otherId < 1 || otherId > MAX_INT) {
      throw new NotFoundException('User not found');
    }
  }
}
