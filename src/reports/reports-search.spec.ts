import { ForbiddenException } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { PrismaService } from '../prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PresenceGateway } from '../friends/presence.gateway';

describe('Ticket search', () => {
  const prisma = {
    user: { findUnique: jest.fn() },
    report: { findMany: jest.fn() },
  };
  const service = new ReportsService(
    prisma as unknown as PrismaService,
    {} as NotificationsService,
    {} as PresenceGateway,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue({
      isAdmin: true,
      email: 'admin@example.test',
    });
    prisma.report.findMany.mockResolvedValue([
      { id: 42, message: 'Broken', _count: { comments: 3 } },
    ]);
  });

  it('returns nothing for a short query without touching the database', async () => {
    await expect(service.search(1, ' a ')).resolves.toEqual([]);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.report.findMany).not.toHaveBeenCalled();
  });

  it('only lets site admins search tickets', async () => {
    prisma.user.findUnique.mockResolvedValue({
      isAdmin: false,
      email: 'someone@example.test',
    });

    await expect(service.search(2, 'broken')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.report.findMany).not.toHaveBeenCalled();
  });

  it('matches the message, note, and author, and returns board tickets', async () => {
    const results = await service.search(1, '  Broken  ');

    const { where, take } = prisma.report.findMany.mock.calls[0][0];
    const contains = { contains: 'Broken', mode: 'insensitive' };
    expect(where.OR).toEqual([
      { message: contains },
      { resolutionNote: contains },
      { author: { username: contains } },
      { author: { name: contains } },
    ]);
    expect(take).toBe(20);
    expect(results).toEqual([{ id: 42, message: 'Broken', commentCount: 3 }]);
  });

  it('finds a ticket by its number', async () => {
    await service.search(1, '#0042');

    const { where } = prisma.report.findMany.mock.calls[0][0];
    expect(where.OR[0]).toEqual({ id: 42 });
  });

  it('caps the query at 100 characters', async () => {
    await service.search(1, 'x'.repeat(150));

    const { where } = prisma.report.findMany.mock.calls[0][0];
    expect(where.OR[0].message.contains).toHaveLength(100);
  });
});
