import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '../../../prisma/generated/client';
import { PrismaService } from '../../prisma.service';
import { CommunitiesService } from '../../communities/communities.service';
import { PresenceGateway } from '../../friends/presence.gateway';
import { AuthService } from '../auth.service';
import { OAuthService } from './oauth.service';

const NONCE = 'nonce-0123456789abcdef';

describe('OAuthService', () => {
  const prisma = {
    oAuthAccount: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      updateMany: jest.fn(),
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
  const presence = { stopLive: jest.fn() };
  const communities = { assertCanManage: jest.fn(), connectTwitch: jest.fn() };
  const service = new OAuthService(
    prisma as unknown as PrismaService,
    jwt,
    auth as unknown as AuthService,
    presence as unknown as PresenceGateway,
    communities as unknown as CommunitiesService,
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
          avatar: 'avatar-hash',
          ...overrides,
        }),
      });
  }

  function stateFor(uid: number | null, nonce = NONCE) {
    const url = new URL(service.authorizeUrl('discord', nonce, uid));
    return url.searchParams.get('state')!;
  }

  it('marks mobile authorization state without changing the web default', () => {
    const mobileUrl = new URL(
      service.authorizeUrl('discord', NONCE, null, null, 'mobile'),
    );
    const webUrl = new URL(service.authorizeUrl('discord', NONCE, null));
    const mobileState = jwt.verify(mobileUrl.searchParams.get('state')!, {
      secret: 'test-secret:oauth-state',
    });
    const webState = jwt.verify(webUrl.searchParams.get('state')!, {
      secret: 'test-secret:oauth-state',
    });

    expect(mobileState).toMatchObject({ client: 'mobile', nonce: NONCE });
    expect(webState).toMatchObject({ client: 'web', nonce: NONCE });
  });

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
    process.env.TWITCH_CLIENT_ID = 'twitch-client';
    process.env.TWITCH_CLIENT_SECRET = 'twitch-secret';
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

  async function startSignup() {
    discordUser();
    const result = await service.complete(
      'discord',
      { code: 'code', state: stateFor(null), nonce: NONCE },
      0,
    );
    if (!('signup' in result)) throw new Error('Expected a sign-up');
    return result.signup;
  }

  it('asks a new account to pick a username before creating it', async () => {
    const signup = await startSignup();

    expect(signup.username).toBe('narutouzumaki');
    expect(signup.avatarUrl).toBe(
      'https://cdn.discordapp.com/avatars/42/avatar-hash.png?size=256',
    );
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('creates the account with the chosen username', async () => {
    const { token } = await startSignup();
    prisma.user.create.mockResolvedValueOnce({
      id: 9,
      email: 'naruto@anime.test',
    });

    const result = await service.finishSignup(token, 'Hokage_Naruto');

    expect(result).toEqual({ access_token: 'token-9' });
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          email: 'naruto@anime.test',
          username: 'hokage_naruto',
          name: 'Naruto',
          avatarUrl:
            'https://cdn.discordapp.com/avatars/42/avatar-hash.png?size=256',
          oauthAccounts: {
            create: {
              provider: 'discord',
              providerAccountId: '42',
              username: 'Naruto.Uzumaki',
            },
          },
        },
      }),
    );
  });

  it('allows a new account to decline the provider avatar', async () => {
    const { token } = await startSignup();
    prisma.user.create.mockResolvedValueOnce({
      id: 9,
      email: 'naruto@anime.test',
    });

    await service.finishSignup(token, 'Hokage_Naruto', false);

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ avatarUrl: null }),
      }),
    );
  });

  it('refuses a username someone already has', async () => {
    const { token } = await startSignup();
    prisma.user.findUnique.mockResolvedValueOnce({ id: 3 });

    await expect(service.finishSignup(token, 'naruto')).rejects.toThrow(
      ConflictException,
    );
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('refuses a sign-up it didn’t start', async () => {
    const forged = new JwtService({ secret: 'other' }).sign({
      provider: 'discord',
      id: '42',
      username: 'naruto',
      displayName: null,
      email: 'naruto@anime.test',
    });

    await expect(service.finishSignup(forged, 'naruto')).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('rejects a state from another browser', async () => {
    await expect(
      service.complete(
        'discord',
        {
          code: 'code',
          state: stateFor(null),
          nonce: 'other-0123456789abcdef',
        },
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

  it('hides a live stream right away when showing it is turned off', async () => {
    prisma.oAuthAccount.updateMany.mockResolvedValueOnce({ count: 1 });

    await service.setShowLive(5, 'twitch', false);

    expect(prisma.oAuthAccount.updateMany).toHaveBeenCalledWith({
      where: { userId: 5, provider: 'twitch' },
      data: { showLive: false },
    });
    expect(presence.stopLive).toHaveBeenCalledWith(5);
  });

  it('only lets Twitch show when you’re live', async () => {
    await expect(service.setShowLive(5, 'discord', true)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('connects a Twitch channel to a community for its admins', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'twitch-token' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { id: '77', login: 'seasonalclub', display_name: 'Seasonal Club' },
          ],
        }),
      });
    const url = await service.communityAuthorizeUrl(5, 'twitch', 12, NONCE);
    const state = new URL(url).searchParams.get('state')!;

    const result = await service.complete(
      'twitch',
      { code: 'code', state, nonce: NONCE },
      5,
    );

    expect(communities.assertCanManage).toHaveBeenCalledWith(5, 12);
    expect(communities.connectTwitch).toHaveBeenCalledWith(5, 12, {
      id: '77',
      login: 'seasonalclub',
    });
    expect(result).toEqual({ linked: 'twitch', communityId: 12 });
  });

  it('only lets communities connect Twitch', async () => {
    await expect(
      service.communityAuthorizeUrl(5, 'discord', 12, NONCE),
    ).rejects.toThrow(BadRequestException);
  });
});
