import { PrismaService } from '../prisma.service';
import { getOwnedGames } from '../steam/steam-api';
import { matchSteamGames } from './library-api';
import { LibraryService } from './library.service';
import { SteamSyncService } from './steam-sync.service';

jest.mock('../steam/steam-api', () => ({
  steamApiKey: () => 'key',
  getOwnedGames: jest.fn(),
}));
jest.mock('./library-api', () => ({ matchSteamGames: jest.fn() }));

describe('Checking Steam games', () => {
  const prisma = {
    steamAccount: {
      updateMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    steamGame: {
      findMany: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
    },
    libraryEntry: { findMany: jest.fn() },
    $transaction: jest.fn(async (operations: unknown[]) => operations),
    $executeRaw: jest.fn(),
  };
  const library = { add: jest.fn() };
  const service = new SteamSyncService(
    prisma as unknown as PrismaService,
    library as unknown as LibraryService,
  );
  const checkedBefore = new Date('2026-10-01T00:00:00Z');

  function account(overrides: Record<string, unknown> = {}) {
    prisma.steamAccount.findUnique.mockResolvedValue({
      steamId: '76561198000000001',
      trackGames: true,
      baselineAt: checkedBefore,
      ...overrides,
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.steamAccount.updateMany.mockResolvedValue({ count: 1 });
    prisma.steamGame.findMany.mockResolvedValue([]);
    prisma.libraryEntry.findMany.mockResolvedValue([]);
    jest.mocked(matchSteamGames).mockResolvedValue({});
  });

  it('checks at most once every 15 minutes', async () => {
    prisma.steamAccount.updateMany.mockResolvedValue({ count: 0 });

    await service.sync(1);

    expect(getOwnedGames).not.toHaveBeenCalled();
  });

  it('treats the first check as the baseline', async () => {
    account({ baselineAt: null });
    jest
      .mocked(getOwnedGames)
      .mockResolvedValue([
        { appId: '367520', minutes: 754, lastPlayedAt: null },
      ]);
    jest
      .mocked(matchSteamGames)
      .mockResolvedValue({
        '367520': { sourceId: '14593', title: 'Hollow Knight' },
      });

    await service.sync(1);

    expect(library.add).not.toHaveBeenCalled();
    expect(prisma.steamGame.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          appId: '367520',
          minutes: 754,
          igdbId: '14593',
        }),
      ],
      skipDuplicates: true,
    });
    expect(prisma.steamAccount.update).toHaveBeenCalledWith({
      where: { userId: 1 },
      data: expect.objectContaining({ baselineAt: expect.any(Date) }),
    });
  });

  it('adds a game as Playing the first time it is played', async () => {
    account();
    prisma.steamGame.findMany
      .mockResolvedValueOnce([
        { appId: '367520', minutes: 0, matchedAt: checkedBefore },
      ])
      .mockResolvedValueOnce([{ igdbId: '14593' }]);
    jest
      .mocked(getOwnedGames)
      .mockResolvedValue([
        { appId: '367520', minutes: 30, lastPlayedAt: null },
      ]);

    await service.sync(1);

    expect(library.add).toHaveBeenCalledWith(1, {
      type: 'game',
      sourceId: '14593',
      status: 'current',
    });
  });

  it('leaves the library alone when adding is turned off', async () => {
    account({ trackGames: false });
    prisma.steamGame.findMany.mockResolvedValueOnce([
      { appId: '367520', minutes: 0, matchedAt: checkedBefore },
    ]);
    jest
      .mocked(getOwnedGames)
      .mockResolvedValue([
        { appId: '367520', minutes: 30, lastPlayedAt: null },
      ]);

    await service.sync(1);

    expect(library.add).not.toHaveBeenCalled();
  });

  it('skips games that are already in the library', async () => {
    account();
    prisma.steamGame.findMany
      .mockResolvedValueOnce([
        { appId: '367520', minutes: 0, matchedAt: checkedBefore },
      ])
      .mockResolvedValueOnce([{ igdbId: '14593' }]);
    prisma.libraryEntry.findMany.mockResolvedValue([{ sourceId: '14593' }]);
    jest
      .mocked(getOwnedGames)
      .mockResolvedValue([
        { appId: '367520', minutes: 30, lastPlayedAt: null },
      ]);

    await service.sync(1);

    expect(library.add).not.toHaveBeenCalled();
  });

  it('remembers when Steam game details are private', async () => {
    account();
    jest.mocked(getOwnedGames).mockResolvedValue(null);

    await service.sync(1);

    expect(prisma.steamAccount.update).toHaveBeenCalledWith({
      where: { userId: 1 },
      data: { gamesPrivate: true },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('saves nothing when matching fails, so the next check tries again', async () => {
    account();
    jest
      .mocked(getOwnedGames)
      .mockResolvedValue([
        { appId: '367520', minutes: 30, lastPlayedAt: null },
      ]);
    jest.mocked(matchSteamGames).mockRejectedValue(new Error('down'));

    await expect(service.sync(1)).rejects.toThrow('down');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
