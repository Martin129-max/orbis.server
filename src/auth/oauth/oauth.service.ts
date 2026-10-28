import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomInt } from 'node:crypto';
import { AuthProvider, Prisma } from '../../../prisma/generated/client';
import { webUrl } from '../../common/web-url';
import { CommunitiesService } from '../../communities/communities.service';
import { PresenceGateway } from '../../friends/presence.gateway';
import { PrismaService } from '../../prisma.service';
import { normalizeUsername, USERNAME_PATTERN } from '../../users/username';
import { AuthService } from '../auth.service';
import {
  OAUTH_TIMEOUT_MS,
  OAuthProfile,
  oauthProviders,
} from './oauth-providers';

export type OAuthResult =
  | { access_token: string }
  | { signup: { token: string; username: string; avatarUrl: string | null } }
  | { linked: AuthProvider }
  | { linked: AuthProvider; communityId: number };

export type OAuthConnections = {
  hasPassword: boolean;
  connections: {
    provider: AuthProvider;
    username: string;
    showLive: boolean;
    connectedAt: Date;
  }[];
};

type StateClaims = {
  provider: AuthProvider;
  nonce: string;
  uid: number | null;
  client: 'web' | 'mobile';
  communityId?: number | null;
};

type SignupClaims = {
  provider: AuthProvider;
  id: string;
  username: string;
  displayName: string | null;
  email: string;
  avatarUrl: string | null;
};

const EXPIRED = 'That sign-in link expired. Please try again.';
const SIGNUP_EXPIRED = 'That sign-up expired. Please start again';
const NONCE_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

function stateSecret() {
  return `${process.env.JWT_SECRET}:oauth-state`;
}

function signupSecret() {
  return `${process.env.JWT_SECRET}:oauth-signup`;
}

function redirectUri(provider: AuthProvider) {
  return `${webUrl()}/auth/${provider}/callback`;
}

function isUniqueViolation(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

@Injectable()
export class OAuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private auth: AuthService,
    private presence: PresenceGateway,
    private communities: CommunitiesService,
  ) {}

  enabled(): AuthProvider[] {
    return Object.values(AuthProvider).filter(
      (provider) =>
        oauthProviders[provider].clientId() &&
        oauthProviders[provider].clientSecret(),
    );
  }

  authorizeUrl(
    provider: AuthProvider,
    nonce: string,
    uid: number | null,
    communityId: number | null = null,
    client: 'web' | 'mobile' = 'web',
  ) {
    const config = this.configured(provider);
    if (!NONCE_PATTERN.test(nonce)) throw new BadRequestException(EXPIRED);

    const claims: StateClaims = { provider, nonce, uid, communityId, client };
    const state = this.jwt.sign(claims, {
      secret: stateSecret(),
      expiresIn: '10m',
    });
    const params = new URLSearchParams({
      client_id: config.clientId()!,
      redirect_uri: redirectUri(provider),
      response_type: 'code',
      scope: config.scope,
      state,
    });
    return `${config.authorizeUrl}?${params}`;
  }

  async communityAuthorizeUrl(
    userId: number,
    provider: AuthProvider,
    communityId: number,
    nonce: string,
  ) {
    if (provider !== 'twitch') {
      throw new BadRequestException('Communities can only connect Twitch');
    }
    await this.communities.assertCanManage(userId, communityId);
    return this.authorizeUrl(provider, nonce, userId, communityId);
  }

  async complete(
    provider: AuthProvider,
    { code, state, nonce }: { code: string; state: string; nonce: string },
    viewerId: number,
  ): Promise<OAuthResult> {
    const claims = this.verifyState(provider, state, nonce);
    const profile = await this.fetchProfile(provider, code);

    if (typeof claims.communityId === 'number') {
      if (claims.uid !== viewerId) {
        throw new ForbiddenException(
          'Log in to the account you’re connecting, then try again.',
        );
      }
      await this.communities.connectTwitch(viewerId, claims.communityId, {
        id: profile.id,
        login: profile.username,
      });
      return { linked: provider, communityId: claims.communityId };
    }

    if (claims.uid !== null) {
      if (claims.uid !== viewerId) {
        throw new ForbiddenException(
          'Log in to the account you’re connecting, then try again.',
        );
      }
      await this.link(claims.uid, provider, profile);
      return { linked: provider };
    }

    const user = await this.existingUser(provider, profile);
    if (user) return this.auth.generateToken(user.id, user.email);

    const signup: SignupClaims = {
      provider,
      id: profile.id,
      username: profile.username,
      displayName: profile.displayName,
      email: profile.email!,
      avatarUrl: profile.avatarUrl,
    };
    return {
      signup: {
        token: this.jwt.sign(signup, {
          secret: signupSecret(),
          expiresIn: '30m',
        }),
        username: await this.freeUsername(profile.username),
        avatarUrl: profile.avatarUrl,
      },
    };
  }

  async finishSignup(
    token: string,
    username: string,
    useProviderAvatar = true,
  ) {
    let claims: SignupClaims;
    try {
      claims = this.jwt.verify<SignupClaims>(token, { secret: signupSecret() });
    } catch {
      throw new BadRequestException(SIGNUP_EXPIRED);
    }
    const { provider, id, displayName, email } = claims;
    const profile: OAuthProfile = {
      id,
      username: claims.username,
      displayName,
      email,
      emailVerified: true,
      avatarUrl: claims.avatarUrl,
    };

    const existing = await this.existingUser(provider, profile);
    if (existing) return this.auth.generateToken(existing.id, existing.email);

    const taken = () => new ConflictException('Username is already taken');
    const normalized = normalizeUsername(username);
    if (
      await this.prisma.user.findUnique({
        where: { username: normalized },
        select: { id: true },
      })
    ) {
      throw taken();
    }

    try {
      const user = await this.prisma.user.create({
        data: {
          email,
          username: normalized,
          name: displayName,
          avatarUrl: useProviderAvatar ? claims.avatarUrl : null,
          oauthAccounts: {
            create: {
              provider,
              providerAccountId: id,
              username: claims.username,
            },
          },
        },
        select: { id: true, email: true },
      });
      return this.auth.generateToken(user.id, user.email);
    } catch (error) {
      if (isUniqueViolation(error)) throw taken();
      throw error;
    }
  }

  async connections(userId: number): Promise<OAuthConnections> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        password: true,
        oauthAccounts: {
          orderBy: { createdAt: 'asc' },
          select: {
            provider: true,
            username: true,
            showLive: true,
            createdAt: true,
          },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');

    return {
      hasPassword: user.password !== null,
      connections: user.oauthAccounts.map(
        ({ provider, username, showLive, createdAt }) => ({
          provider,
          username,
          showLive,
          connectedAt: createdAt,
        }),
      ),
    };
  }

  async disconnect(userId: number, provider: AuthProvider) {
    const { label } = oauthProviders[provider];
    const { hasPassword, connections } = await this.connections(userId);
    if (!connections.some((connection) => connection.provider === provider)) {
      throw new NotFoundException(`${label} isn’t connected`);
    }
    if (!hasPassword && connections.length === 1) {
      throw new BadRequestException(
        `${label} is the only way you log in, so it can’t be disconnected yet.`,
      );
    }

    await this.prisma.oAuthAccount.delete({
      where: { userId_provider: { userId, provider } },
    });
    if (provider === 'twitch') await this.presence.stopLive(userId);
  }

  async setShowLive(userId: number, provider: AuthProvider, showLive: boolean) {
    if (provider !== 'twitch') {
      throw new BadRequestException('Only Twitch can show when you’re live');
    }
    const { count } = await this.prisma.oAuthAccount.updateMany({
      where: { userId, provider },
      data: { showLive },
    });
    if (count === 0) throw new NotFoundException('Twitch isn’t connected');
    if (!showLive) await this.presence.stopLive(userId);
  }

  private configured(provider: AuthProvider) {
    const config = oauthProviders[provider];
    if (!config.clientId() || !config.clientSecret()) {
      throw new ServiceUnavailableException(
        `${config.label} login isn’t set up yet.`,
      );
    }
    return config;
  }

  private verifyState(provider: AuthProvider, state: string, nonce: string) {
    let claims: StateClaims;
    try {
      claims = this.jwt.verify<StateClaims>(state, { secret: stateSecret() });
    } catch {
      throw new BadRequestException(EXPIRED);
    }
    if (claims.provider !== provider || claims.nonce !== nonce) {
      throw new BadRequestException(EXPIRED);
    }
    return claims;
  }

  private async fetchProfile(provider: AuthProvider, code: string) {
    const config = this.configured(provider);
    const clientId = config.clientId()!;
    try {
      const response = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: config.clientSecret()!,
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri(provider),
        }),
        signal: AbortSignal.timeout(OAUTH_TIMEOUT_MS),
      });
      if (!response.ok)
        throw new Error(`Token request failed with ${response.status}`);
      const { access_token: accessToken } = await response.json();
      return await config.profile(accessToken, clientId);
    } catch {
      throw new BadGatewayException(
        `Couldn’t finish logging in with ${config.label}. Please try again.`,
      );
    }
  }

  private async existingUser(provider: AuthProvider, profile: OAuthProfile) {
    const { label } = oauthProviders[provider];
    const linked = await this.prisma.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: { provider, providerAccountId: profile.id },
      },
      select: { user: { select: { id: true, email: true } } },
    });
    if (linked) return linked.user;

    if (!profile.email || !profile.emailVerified) {
      throw new BadRequestException(
        `Verify your email on ${label} first, then try again.`,
      );
    }

    const account = {
      provider,
      providerAccountId: profile.id,
      username: profile.username,
    };
    const existing = await this.prisma.user.findFirst({
      where: { email: { equals: profile.email, mode: 'insensitive' } },
      select: { id: true, email: true },
    });
    if (existing) {
      try {
        await this.prisma.oAuthAccount.create({
          data: { ...account, userId: existing.id },
        });
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        throw new ConflictException(
          `This Orbis account is connected to a different ${label} account.`,
        );
      }
      return existing;
    }

    return null;
  }

  private async link(
    userId: number,
    provider: AuthProvider,
    profile: OAuthProfile,
  ) {
    const { label } = oauthProviders[provider];
    try {
      await this.prisma.oAuthAccount.create({
        data: {
          userId,
          provider,
          providerAccountId: profile.id,
          username: profile.username,
        },
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const owner = await this.prisma.oAuthAccount.findUnique({
        where: {
          provider_providerAccountId: {
            provider,
            providerAccountId: profile.id,
          },
        },
        select: { userId: true },
      });
      if (owner?.userId === userId) return;
      throw new ConflictException(
        owner
          ? `That ${label} account is already connected to another Orbis account.`
          : `You already have a ${label} account connected. Disconnect it first.`,
      );
    }
  }

  private async freeUsername(source: string) {
    const base = source
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '')
      .slice(0, 15)
      .padEnd(3, '_');

    for (let attempt = 0; attempt < 10; attempt++) {
      const candidate =
        attempt === 0 ? base : `${base}_${randomInt(1000, 10000)}`;
      if (!USERNAME_PATTERN.test(candidate)) continue;
      const taken = await this.prisma.user.findUnique({
        where: { username: candidate },
        select: { id: true },
      });
      if (!taken) return candidate;
    }
    throw new ConflictException('Couldn’t pick a username. Please try again.');
  }
}
