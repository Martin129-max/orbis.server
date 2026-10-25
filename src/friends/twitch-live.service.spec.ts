import { PrismaService } from '../prisma.service';
import { PresenceGateway } from './presence.gateway';
import { TwitchLiveService } from './twitch-live.service';

describe('TwitchLiveService', () => {
  const prisma = {
    oAuthAccount: { findMany: jest.fn() },
    community: { findMany: jest.fn() },
  };
  const presence = { updateLive: jest.fn(), updateLiveCommunities: jest.fn() };
  const fetchMock = jest.fn();
  const service = new TwitchLiveService(
    prisma as unknown as PrismaService,
    presence as unknown as PresenceGateway,
  );

  beforeAll(() => {
    process.env.TWITCH_CLIENT_ID = 'client';
    process.env.TWITCH_CLIENT_SECRET = 'secret';
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.community.findMany.mockResolvedValue([]);
  });

  it('marks connected accounts that are live on Twitch', async () => {
    prisma.oAuthAccount.findMany.mockResolvedValue([
      { userId: 1, providerAccountId: 'a' },
      { userId: 2, providerAccountId: 'b' },
    ]);
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'app-token', expires_in: 3600 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [{ user_id: 'b', type: 'live' }] }),
      });

    await service.poll();

    expect(prisma.oAuthAccount.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { provider: 'twitch', showLive: true } }),
    );
    expect(fetchMock.mock.calls[1][0]).toContain('user_id=a&user_id=b');
    expect(presence.updateLive).toHaveBeenCalledWith(new Set([2]));
  });

  it('keeps the current live list when Twitch can’t be reached', async () => {
    prisma.oAuthAccount.findMany.mockResolvedValue([
      { userId: 1, providerAccountId: 'a' },
    ]);
    fetchMock.mockRejectedValue(new Error('offline'));

    await service.poll();

    expect(presence.updateLive).not.toHaveBeenCalled();
  });

  it('marks communities whose Twitch channel is live', async () => {
    prisma.oAuthAccount.findMany.mockResolvedValue([
      { userId: 1, providerAccountId: 'a' },
    ]);
    prisma.community.findMany.mockResolvedValue([
      { id: 12, twitchUserId: 'c' },
      { id: 13, twitchUserId: 'd' },
    ]);
    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ user_id: 'c', type: 'live' }] }),
    });

    await service.poll();

    expect(presence.updateLive).toHaveBeenCalledWith(new Set());
    expect(presence.updateLiveCommunities).toHaveBeenCalledWith(new Set([12]));
  });
});
