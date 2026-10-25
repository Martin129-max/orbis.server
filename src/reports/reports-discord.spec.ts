import { Logger } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { postReportToDiscord } from './discord';
import { PrismaService } from '../prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PresenceGateway } from '../friends/presence.gateway';

jest.mock('./discord', () => ({
  ...jest.requireActual('./discord'),
  postReportToDiscord: jest.fn(),
  postActivityToDiscord: jest.fn(),
}));

const person = { id: 1, username: 'admin', name: null, avatarUrl: null };
const report = {
  id: 42,
  category: 'bug',
  status: 'todo',
  authorId: 1,
  message: 'Ticket text',
  pageUrl: null,
  createdAt: new Date(),
  author: person,
  assignee: null,
  hiddenAt: null,
  resolutionNote: null,
  _count: { comments: 0 },
};

describe('Ticket activity snapshots', () => {
  beforeAll(() => {
    process.env.WEB_URL = 'https://orbis.test';
  });

  const prisma = {
    user: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn() },
    report: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    reportComment: { create: jest.fn(), findMany: jest.fn() },
    setting: { findUnique: jest.fn() },
  };
  const notifications = { notify: jest.fn() };
  const service = new ReportsService(
    prisma as unknown as PrismaService,
    notifications as unknown as NotificationsService,
    {} as PresenceGateway,
  );
  let share: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue({
      isAdmin: true,
      email: 'admin@example.test',
    });
    prisma.report.findUnique.mockResolvedValue({ ...report, assigneeId: 1 });
    prisma.report.findUniqueOrThrow.mockResolvedValue(report);
    prisma.reportComment.create.mockResolvedValue({ id: 9 });
    prisma.reportComment.findMany.mockResolvedValue([]);
    share = jest
      .spyOn(service, 'shareActivity')
      .mockImplementation(() => undefined);
  });
  afterEach(() => share.mockRestore());

  it.each([
    ['assign', { ...report, assignee: person }, () => service.assign(1, 42, 2)],
    ['unassign', report, () => service.assign(1, 42, null)],
    [
      'status',
      { ...report, status: 'done', resolutionNote: 'Fixed' },
      () => service.update(1, 42, { status: 'done', note: 'Fixed' }),
    ],
    ['hide', { ...report, hiddenAt: new Date() }, () => service.hide(1, 42)],
    ['restore', report, () => service.restore(1, 42)],
  ])(
    'includes the updated snapshot for %s',
    async (_action, updated, perform: () => Promise<unknown>) => {
      prisma.report.update.mockResolvedValue(updated);
      await perform();
      const activity = share.mock.calls[0][1]('Admin');
      const { _count, ...snapshot } = updated;
      expect(activity.report).toMatchObject(snapshot);
    },
  );

  it('includes a ticket snapshot and comment preview for comments', async () => {
    await service.addComment(1, 42, 'More details');
    expect(share.mock.calls[0][1]('Admin')).toMatchObject({
      report,
      description: 'More details',
    });
  });

  it('posts the new ticket snapshot when a webhook is configured', async () => {
    prisma.report.create.mockResolvedValue(report);
    prisma.setting.findUnique.mockResolvedValue({
      key: 'reports.discordWebhook',
      value: 'https://discord.test/webhook',
    });
    await expect(
      service.create(1, { category: 'bug', message: report.message }),
    ).resolves.toEqual({ id: 42 });
    await new Promise(setImmediate);
    expect(postReportToDiscord).toHaveBeenCalledWith(
      {
        webhookUrl: 'https://discord.test/webhook',
        siteUrl: 'https://orbis.test',
      },
      report,
    );
  });

  it('preserves ticket creation when Discord delivery fails', async () => {
    const warning = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    prisma.report.create.mockResolvedValue(report);
    prisma.setting.findUnique.mockResolvedValue({
      key: 'reports.discordWebhook',
      value: 'https://discord.test/webhook',
    });
    jest
      .mocked(postReportToDiscord)
      .mockRejectedValueOnce(new Error('Delivery failed'));
    await expect(
      service.create(1, { category: 'bug', message: report.message }),
    ).resolves.toEqual({ id: 42 });
    await new Promise(setImmediate);
    expect(warning).toHaveBeenCalled();
    warning.mockRestore();
  });

  it('skips posting when the webhook is disabled', async () => {
    prisma.report.create.mockResolvedValue(report);
    prisma.setting.findUnique.mockResolvedValue(null);
    await service.create(1, { category: 'bug', message: report.message });
    await new Promise(setImmediate);
    expect(postReportToDiscord).not.toHaveBeenCalled();
  });
});
