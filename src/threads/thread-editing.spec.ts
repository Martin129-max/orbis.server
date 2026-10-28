import { ForbiddenException } from '@nestjs/common';
import { ThreadsService } from './threads.service';
import { PrismaService } from '../prisma.service';
import { VotesService } from '../votes/votes.service';
import { NotificationsService } from '../notifications/notifications.service';
import { DiscordChannelService } from '../discord-channel/discord-channel.service';

jest.mock('../common/rich-text', () => ({
  sanitizeRichText: (html: string) => ({
    html,
    empty: !html.replace(/<[^>]+>/g, '').trim(),
  }),
}));

describe('Editing and deleting threads', () => {
  const prisma = {
    thread: { findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
    comment: { findMany: jest.fn(), deleteMany: jest.fn() },
    vote: { deleteMany: jest.fn() },
    user: { findMany: jest.fn().mockResolvedValue([]) },
    membership: { findMany: jest.fn() },
    $transaction: jest.fn((operations: unknown[]) => Promise.all(operations)),
  };
  const discordChannel = {
    contentEdited: jest.fn(),
    contentDeleted: jest.fn(),
  };
  const service = new ThreadsService(
    prisma as unknown as PrismaService,
    {
      myVotes: jest.fn().mockResolvedValue(new Map()),
    } as unknown as VotesService,
    { notify: jest.fn() } as unknown as NotificationsService,
    discordChannel as unknown as DiscordChannelService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.membership.findMany.mockResolvedValue([]);
    prisma.comment.findMany.mockResolvedValue([]);
    prisma.thread.findUnique.mockResolvedValue({
      authorId: 1,
      content: '',
      communityId: 3,
    });
  });

  it('saves a new title and content and tells Discord', async () => {
    prisma.thread.update.mockImplementation(({ data }) => ({
      id: 4,
      authorId: 1,
      communityId: 3,
      author: { id: 1, username: 'reader', name: null, avatarUrl: null },
      ...data,
    }));

    const updated = await service.update(1, 4, {
      title: '  Best arc?  ',
      content: '<p>Arguments welcome</p>',
    });

    expect(prisma.thread.update.mock.calls[0][0].data).toMatchObject({
      title: 'Best arc?',
      editedAt: expect.any(Date),
    });
    expect(updated).toMatchObject({ canDelete: true, myVote: 0 });
    expect(discordChannel.contentEdited).toHaveBeenCalledWith('thread', 4);
  });

  it('won’t let someone else edit it', async () => {
    await expect(service.update(2, 4, { title: 'Mine' })).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('deletes the thread with its votes and comments', async () => {
    await service.remove(1, 4);

    expect(prisma.vote.deleteMany).toHaveBeenCalledWith({
      where: { votableType: 'thread', votableId: { in: [4] } },
    });
    expect(prisma.thread.delete).toHaveBeenCalledWith({ where: { id: 4 } });
    expect(discordChannel.contentDeleted).toHaveBeenCalledWith('thread', 4);
  });

  it('won’t let a regular member delete someone else’s thread', async () => {
    await expect(service.remove(2, 4)).rejects.toThrow(ForbiddenException);
    expect(prisma.thread.delete).not.toHaveBeenCalled();
  });
});
