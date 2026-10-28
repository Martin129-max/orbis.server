import { CommunitiesService } from './communities.service';
import { PrismaService } from '../prisma.service';
import { StorageService } from '../storage/storage.service';
import { PresenceGateway } from '../friends/presence.gateway';
import { TwitchLiveService } from '../friends/twitch-live.service';

describe('Unfinished Discord setup', () => {
  const prisma = {
    membership: { findMany: jest.fn(), findUnique: jest.fn() },
  };
  const service = new CommunitiesService(
    prisma as unknown as PrismaService,
    {} as StorageService,
    {} as PresenceGateway,
    {} as TwitchLiveService,
  );
  const fetchMock = jest.fn();
  const originalFetch = global.fetch;

  function connected(id: number, guildId: string) {
    return {
      community: {
        id,
        name: `Community ${id}`,
        discordGuildId: guildId,
        discordGuildName: `Server ${id}`,
      },
    };
  }

  function role(ownerId: number, admin: boolean) {
    return {
      community: { ownerId },
      roles: admin ? [{ role: { permissions: BigInt(1) } }] : [],
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('lists communities the user manages whose Discord widget is off', async () => {
    prisma.membership.findMany.mockResolvedValue([
      connected(1, '400000000000000001'),
      connected(2, '400000000000000002'),
    ]);
    prisma.membership.findUnique
      .mockResolvedValueOnce(role(7, false))
      .mockResolvedValueOnce(role(9, true));
    fetchMock.mockResolvedValue({ ok: false });

    await expect(service.unfinishedDiscord(7)).resolves.toEqual([
      { id: 1, name: 'Community 1', discordGuildName: 'Server 1' },
      { id: 2, name: 'Community 2', discordGuildName: 'Server 2' },
    ]);
    expect(prisma.membership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 7, community: { discordGuildId: { not: null } } },
      }),
    );
  });

  it('leaves out communities where the user is only a member', async () => {
    prisma.membership.findMany.mockResolvedValue([
      connected(3, '400000000000000003'),
    ]);
    prisma.membership.findUnique.mockResolvedValue(role(9, false));

    await expect(service.unfinishedDiscord(7)).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('leaves out communities whose Discord widget is on', async () => {
    prisma.membership.findMany.mockResolvedValue([
      connected(4, '400000000000000004'),
    ]);
    prisma.membership.findUnique.mockResolvedValue(role(7, false));
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ presence_count: 5, instant_invite: null }),
    });

    await expect(service.unfinishedDiscord(7)).resolves.toEqual([]);
  });
});
