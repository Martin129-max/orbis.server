import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { MESSAGE_LIMIT } from './conversation';
import { PrismaService } from '../prisma.service';
import { PresenceGateway } from '../friends/presence.gateway';

const date = new Date('2026-10-24T12:00:00Z');
const users = {
  1: { id: 1, username: 'admin', name: 'Admin', avatarUrl: null },
  2: { id: 2, username: 'naruto', name: 'Naruto Uzumaki', avatarUrl: null },
};
const summary = { lastText: 'Hi', lastSenderId: 1, lastMessageAt: date };

describe('MessagesService', () => {
  const prisma = {
    user: { findUnique: jest.fn(({ where: { id } }) => users[id] ?? null) },
    friendship: { findFirst: jest.fn() },
    conversation: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    conversationMember: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    message: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn((run) => run(prisma)),
  };
  const presence = { notify: jest.fn() };
  const service = new MessagesService(
    prisma as unknown as PrismaService,
    presence as unknown as PresenceGateway,
  );

  function memberOf(status: 'accepted' | 'request' | null) {
    prisma.conversation.findUnique.mockResolvedValue(
      status ? { id: 5, members: [{ status }] } : null,
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.friendship.findFirst.mockResolvedValue(null);
    prisma.conversation.upsert.mockResolvedValue({ id: 5 });
    prisma.conversation.update.mockResolvedValue(summary);
    prisma.conversationMember.findUnique.mockResolvedValue(null);
    prisma.conversationMember.upsert.mockImplementation(({ create }) => ({
      unread: create.unread ?? 0,
      status: create.status ?? 'accepted',
    }));
    prisma.message.create.mockResolvedValue({
      id: 9,
      senderId: 1,
      text: 'Hi',
      createdAt: date,
    });
    prisma.message.findFirst.mockResolvedValue(null);
  });

  describe('send', () => {
    it('sends a first message to a non-friend as a request', async () => {
      const sent = await service.send(1, 2, '  Hi  ');

      expect(sent).toEqual({
        id: 9,
        senderId: 1,
        text: 'Hi',
        sentAt: date.toISOString(),
      });
      expect(prisma.message.create).toHaveBeenCalledWith({
        data: { conversationId: 5, senderId: 1, text: 'Hi' },
      });
      expect(prisma.conversationMember.upsert).toHaveBeenLastCalledWith(
        expect.objectContaining({
          create: {
            conversationId: 5,
            userId: 2,
            status: 'request',
            unread: 1,
          },
          update: { status: 'request', unread: { increment: 1 } },
        }),
      );
      expect(presence.notify).toHaveBeenCalledWith([2], 'message', {
        conversation: expect.objectContaining({
          userId: 1,
          username: 'admin',
          status: 'request',
          unread: 1,
        }),
        message: sent,
      });
      expect(presence.notify).toHaveBeenCalledWith([1], 'message', {
        conversation: expect.objectContaining({
          userId: 2,
          status: 'accepted',
        }),
        message: sent,
      });
    });

    it('delivers to the chat list between friends or accepted chats', async () => {
      prisma.friendship.findFirst.mockResolvedValueOnce({ requesterId: 1 });
      await service.send(1, 2, 'Hi');
      expect(prisma.conversationMember.upsert).toHaveBeenLastCalledWith(
        expect.objectContaining({
          update: { status: 'accepted', unread: { increment: 1 } },
        }),
      );

      prisma.conversationMember.findUnique.mockResolvedValueOnce({
        status: 'accepted',
      });
      await service.send(1, 2, 'Again');
      expect(prisma.conversationMember.upsert).toHaveBeenLastCalledWith(
        expect.objectContaining({
          update: { status: 'accepted', unread: { increment: 1 } },
        }),
      );
    });

    it(`keeps only the newest ${MESSAGE_LIMIT} messages`, async () => {
      prisma.message.findFirst.mockResolvedValueOnce({ id: 40 });

      await service.send(1, 2, 'Hi');

      expect(prisma.message.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: MESSAGE_LIMIT,
          orderBy: { id: 'desc' },
        }),
      );
      expect(prisma.message.deleteMany).toHaveBeenCalledWith({
        where: { conversationId: 5, id: { lte: 40 } },
      });
    });

    it('rejects empty messages, yourself and missing users', async () => {
      await expect(service.send(1, 2, '   ')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(service.send(1, 1, 'Hi')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(service.send(1, 99, 'Hi')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(service.send(1, 2 ** 31, 'Hi')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.message.create).not.toHaveBeenCalled();
    });
  });

  it('lists the inbox with the other person in each chat', async () => {
    prisma.conversationMember.findMany.mockResolvedValue([
      {
        unread: 2,
        status: 'accepted',
        conversation: { ...summary, userA: users[1], userB: users[2] },
      },
    ]);

    await expect(service.inbox(1)).resolves.toEqual([
      expect.objectContaining({
        userId: 2,
        username: 'naruto',
        unread: 2,
        lastAt: date.toISOString(),
      }),
    ]);
  });

  it('returns pages oldest first with the other person’s read time', async () => {
    prisma.conversation.findUnique.mockResolvedValue({
      id: 5,
      members: [
        { userId: 1, readAt: null },
        { userId: 2, readAt: date },
      ],
    });
    prisma.message.findMany.mockResolvedValue([
      { id: 3, senderId: 2, text: 'b', createdAt: date },
      { id: 2, senderId: 1, text: 'a', createdAt: date },
    ]);

    const thread = await service.thread(1, 2, 4);

    expect(prisma.message.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { conversationId: 5, id: { lt: 4 } } }),
    );
    expect(thread.messages.map(({ id }) => id)).toEqual([2, 3]);
    expect(thread).toMatchObject({
      seenAt: date.toISOString(),
      hasMore: false,
    });
  });

  it('marks chats read and tells the sender only for accepted chats', async () => {
    memberOf('accepted');
    await service.read(1, 2);
    expect(presence.notify).toHaveBeenCalledWith(
      [2],
      'messages:read',
      expect.objectContaining({ userId: 1 }),
    );

    jest.clearAllMocks();
    memberOf('request');
    await service.read(1, 2);
    expect(prisma.conversationMember.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { unread: 0 } }),
    );
    expect(presence.notify).not.toHaveBeenCalledWith(
      [2],
      'messages:read',
      expect.anything(),
    );
  });

  it('accepts and declines only pending requests', async () => {
    memberOf('request');
    await service.accept(1, 2);
    expect(prisma.conversationMember.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'accepted' } }),
    );
    await service.decline(1, 2);
    expect(prisma.conversationMember.delete).toHaveBeenCalled();

    memberOf('accepted');
    await expect(service.accept(1, 2)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    memberOf(null);
    await expect(service.decline(1, 2)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('relays typing only into chats the other person has accepted', async () => {
    memberOf('accepted');
    await service.typing(1, 2, true);
    expect(presence.notify).toHaveBeenCalledWith([2], 'typing', {
      userId: 1,
      typing: true,
    });

    jest.clearAllMocks();
    memberOf('request');
    await service.typing(1, 2, true);
    expect(presence.notify).not.toHaveBeenCalled();
  });
});
