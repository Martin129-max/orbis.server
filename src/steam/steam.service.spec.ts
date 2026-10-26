import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SteamSyncService } from '../library/steam-sync.service';
import { PrismaService } from '../prisma.service';
import { verifyOpenId } from './steam-api';
import { SteamService } from './steam.service';

jest.mock('./steam-api', () => ({
  steamApiKey: () => 'key',
  openIdUrl: jest.fn(
    (returnTo: string) =>
      `https://steam.test?return_to=${encodeURIComponent(returnTo)}`,
  ),
  verifyOpenId: jest.fn(),
  getPersonaName: jest.fn().mockResolvedValue('Hornet'),
}));

const NONCE = 'nonce-0123456789abcdef';

describe('Connecting Steam', () => {
  const prisma = {
    steamAccount: { findUnique: jest.fn(), upsert: jest.fn() },
    steamGame: { count: jest.fn().mockResolvedValue(0) },
  };
  const steamSync = { refresh: jest.fn() };
  const service = new SteamService(
    prisma as unknown as PrismaService,
    new JwtService(),
    steamSync as unknown as SteamSyncService,
  );

  function stateFor(userId: number) {
    const url = new URL(service.connectUrl(userId, NONCE));
    const returnTo = new URL(url.searchParams.get('return_to')!);
    return returnTo.searchParams.get('state')!;
  }

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret';
  });

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.steamAccount.findUnique.mockResolvedValue(null);
  });

  it('only connects for the account that started it', async () => {
    await expect(
      service.connect(6, { state: stateFor(5), nonce: NONCE, params: {} }),
    ).rejects.toThrow(ForbiddenException);
    expect(verifyOpenId).not.toHaveBeenCalled();
  });

  it('rejects a link from another browser', async () => {
    await expect(
      service.connect(5, {
        state: stateFor(5),
        nonce: 'other-0123456789abcdef',
        params: {},
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('refuses a sign-in Steam could not confirm', async () => {
    jest.mocked(verifyOpenId).mockResolvedValueOnce(null);

    await expect(
      service.connect(5, { state: stateFor(5), nonce: NONCE, params: {} }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.steamAccount.upsert).not.toHaveBeenCalled();
  });

  it('saves the account and takes the first snapshot right away', async () => {
    jest.mocked(verifyOpenId).mockResolvedValueOnce('76561198000000001');

    await service.connect(5, { state: stateFor(5), nonce: NONCE, params: {} });

    expect(prisma.steamAccount.upsert).toHaveBeenCalledWith({
      where: { userId: 5 },
      create: {
        userId: 5,
        steamId: '76561198000000001',
        personaName: 'Hornet',
      },
      update: { personaName: 'Hornet' },
    });
    expect(steamSync.refresh).toHaveBeenCalledWith(5, {
      waitMs: expect.any(Number),
      force: true,
    });
  });
});
