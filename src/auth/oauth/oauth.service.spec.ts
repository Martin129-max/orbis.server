import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '../../../prisma/generated/client';
import { PrismaService } from '../../prisma.service';
import { AuthService } from '../auth.service';
import { OAuthService } from './oauth.service';

const NONCE = 'nonce-0123456789abcdef';

describe('OAuthService', () => {
  const prisma = {
    oAuthAccount: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };
  const jwt = new JwtService({ secret: 'test-secret' });
  const auth = {
    generateToken: jest.fn((id: number) => ({ access_token: `token-${id}` })),
  };
  const service = new OAuthService(
    prisma as unknown as PrismaService,
    jwt,
    auth as unknown as AuthService,
  );
  const fetchMock = jest.fn();

  function discordUser(overrides: Record<string, unknown> = {}) {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'discord-token' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: '42',
          username: 'Naruto.Uzumaki',
          global_name: 'Naruto',
          email: 'naruto@anime.test',
          verified: true,
          ...overrides,
        }),
      });
  }

  function stateFor(uid: number | null, nonce = NONCE) {
    const url = new URL(service.authorizeUrl('discord', nonce, uid));
    return url.searchParams.get('state')!;
  }

  function uniqueViolation() {
    return new Prisma.PrismaClientKnownRequestError('Unique', {
      code: 'P2002',
      clientVersion: 'test',
    });
  }

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret';
    process.env.DISCORD_CLIENT_ID = 'client';
    process.env.DISCORD_CLIENT_SECRET = 'secret';
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.oAuthAccount.findUnique.mockResolvedValue(null);
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue(null);
  });

  it('connects an existing account with the same verified email', async () => {
    discordUser();
    prisma.user.findFirst.mockResolvedValueOnce({
      id: 7,
      email: 'Naruto@Anime.test',
    });

    const result = await service.complete(
      'discord',
      { code: 'code', state: stateFor(null), nonce: NONCE },
      0,
    );

    expect(result).toEqual({ access_token: 'token-7' });
    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: { equals: 'naruto@anime.test', mode: 'insensitive' } },
      }),
    );
    expect(prisma.oAuthAccount.create).toHaveBeenCalledWith({
      data: {
        provider: 'discord',
        providerAccountId: '42',
        username: 'Naruto.Uzumaki',
        userId: 7,
      },
    });
  });

  it('refuses an email the provider hasn’t verified', async () => {
    discordUser({ verified: false });

    await expect(
      service.complete(
        'discord',
        { code: 'code', state: stateFor(null), nonce: NONCE },
        0,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.oAuthAccount.create).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('signs up a new account with a valid, free username', async () => {
    discordUser();
    prisma.user.create.mockResolvedValueOnce({
      id: 9,
      email: 'naruto@anime.test',
    });

    const result = await service.complete(
      'discord',
      { code: 'code', state: stateFor(null), nonce: NONCE },
      0,
    );

    expect(result).toEqual({ access_token: 'token-9' });
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'naruto@anime.test',
          username: 'narutouzumaki',
          name: 'Naruto',
        }),
      }),
    );
  });

  it('rejects a state from another browser', async () => {
    await expect(
      service.complete(
        'discord',
        { code: 'code', state: stateFor(null), nonce: 'other-0123456789abcdef' },
        0,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('connects only for the account that started it', async () => {
    discordUser();

    await expect(
      service.complete(
        'discord',
        { code: 'code', state: stateFor(5), nonce: NONCE },
        6,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('refuses to connect an account another user already has', async () => {
    discordUser();
    prisma.oAuthAccount.create.mockRejectedValueOnce(uniqueViolation());
    prisma.oAuthAccount.findUnique.mockResolvedValueOnce({ userId: 99 });

    await expect(
      service.complete(
        'discord',
        { code: 'code', state: stateFor(5), nonce: NONCE },
        5,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('keeps the only way to log in', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      password: null,
      oauthAccounts: [
        { provider: 'discord', username: 'naruto', createdAt: new Date() },
      ],
    });

    await expect(service.disconnect(5, 'discord')).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.oAuthAccount.delete).not.toHaveBeenCalled();
  });

  it('disconnects when a password is set', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      password: 'hash',
      oauthAccounts: [
        { provider: 'discord', username: 'naruto', createdAt: new Date() },
      ],
    });

    await service.disconnect(5, 'discord');

    expect(prisma.oAuthAccount.delete).toHaveBeenCalledWith({
      where: { userId_provider: { userId: 5, provider: 'discord' } },
    });
  });
});
