import { PrismaService } from '../prisma.service';
import { getPlayingGames } from '../steam/steam-api';
import { PresenceGateway } from './presence.gateway';
import { SteamPlayingService } from './steam-playing.service';

jest.mock('../steam/steam-api', () => ({
  steamApiKey: () => 'key',
  getPlayingGames: jest.fn(),
}));

describe('Steam games being played', () => {
  const prisma = { steamAccount: { findMany: jest.fn() } };
  const presence = { updatePlaying: jest.fn() };
  const service = new SteamPlayingService(
    prisma as unknown as PrismaService,
    presence as unknown as PresenceGateway,
  );

  beforeEach(() => jest.clearAllMocks());

  it('shares what people who allow it are playing', async () => {
    prisma.steamAccount.findMany.mockResolvedValue([
      { userId: 1, steamId: 'a' },
      { userId: 2, steamId: 'b' },
    ]);
    jest
      .mocked(getPlayingGames)
      .mockResolvedValue(new Map([['b', 'NBA 2K26']]));

    await service.poll();

    expect(prisma.steamAccount.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { showPlaying: true } }),
    );
    expect(getPlayingGames).toHaveBeenCalledWith(['a', 'b']);
    expect(presence.updatePlaying).toHaveBeenCalledWith(
      new Map([[2, 'NBA 2K26']]),
    );
  });

  it('keeps the current games when Steam can’t be reached', async () => {
    prisma.steamAccount.findMany.mockResolvedValue([
      { userId: 1, steamId: 'a' },
    ]);
    jest.mocked(getPlayingGames).mockRejectedValue(new Error('down'));

    await service.poll();

    expect(presence.updatePlaying).not.toHaveBeenCalled();
  });
});
