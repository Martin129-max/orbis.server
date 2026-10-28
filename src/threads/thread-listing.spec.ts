import { BadRequestException } from '@nestjs/common';
import { ThreadsService } from './threads.service';
import { PrismaService } from '../prisma.service';
import { VotesService } from '../votes/votes.service';
import { NotificationsService } from '../notifications/notifications.service';
import { DiscordChannelService } from '../discord-channel/discord-channel.service';

jest.mock('../common/rich-text', () => ({ sanitizeRichText: jest.fn() }));

describe('Listing threads by time range', () => {
  const prisma = {
    thread: { findMany: jest.fn().mockResolvedValue([]) },
    contentReport: { findMany: jest.fn().mockResolvedValue([]) },
    membership: { findMany: jest.fn().mockResolvedValue([]) },
    $queryRaw: jest.fn().mockResolvedValue([]),
  };
  const service = new ThreadsService(
    prisma as unknown as PrismaService,
    {
      myVotes: jest.fn().mockResolvedValue(new Map()),
    } as unknown as VotesService,
    {} as NotificationsService,
    {} as DiscordChannelService,
  );
  const DAY = 24 * 60 * 60 * 1000;

  beforeEach(() => jest.clearAllMocks());

  it('only lists threads from the chosen window', async () => {
    const before = Date.now();

    await service.list(1, 3, 'top', 0, 'week');

    const { createdAt } = prisma.thread.findMany.mock.calls[0][0].where;
    expect(createdAt.gte.getTime()).toBeGreaterThanOrEqual(before - 7 * DAY);
    expect(createdAt.gte.getTime()).toBeLessThanOrEqual(Date.now() - 7 * DAY);
  });

  it('lists everything for all time', async () => {
    await service.list(1, 3, 'new');

    expect(prisma.thread.findMany.mock.calls[0][0].where.createdAt).toEqual({
      gte: new Date(0),
    });
  });

  it('applies the window to hot threads too', async () => {
    await service.list(1, 3, 'hot', 0, 'day');

    const since = prisma.$queryRaw.mock.calls[0].find(
      (value: unknown) => value instanceof Date,
    );
    expect(Date.now() - since.getTime()).toBeGreaterThanOrEqual(DAY - 1000);
  });

  it('rejects unknown ranges', async () => {
    await expect(service.list(1, 3, 'top', 0, 'decade')).rejects.toThrow(
      BadRequestException,
    );
  });
});
