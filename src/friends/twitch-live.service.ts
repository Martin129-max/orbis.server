import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  OAUTH_TIMEOUT_MS,
  oauthProviders,
} from '../auth/oauth/oauth-providers';
import { PrismaService } from '../prisma.service';
import { PresenceGateway } from './presence.gateway';

const POLL_MS = 60_000;
const BATCH_SIZE = 100;

@Injectable()
export class TwitchLiveService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TwitchLiveService.name);
  private timer?: NodeJS.Timeout;
  private appToken: { value: string; expiresAt: number } | null = null;

  constructor(
    private prisma: PrismaService,
    private presence: PresenceGateway,
  ) {}

  onModuleInit() {
    if (!this.credentials()) return;
    this.timer = setInterval(() => void this.poll(), POLL_MS);
    this.timer.unref();
    void this.poll();
  }

  onModuleDestroy() {
    clearInterval(this.timer);
  }

  async poll() {
    try {
      const [accounts, communities] = await Promise.all([
        this.prisma.oAuthAccount.findMany({
          where: { provider: 'twitch', showLive: true },
          select: { userId: true, providerAccountId: true },
        }),
        this.prisma.community.findMany({
          where: { twitchUserId: { not: null } },
          select: { id: true, twitchUserId: true },
        }),
      ]);

      const channels = [
        ...new Set([
          ...accounts.map((account) => account.providerAccountId),
          ...communities.map((community) => community.twitchUserId!),
        ]),
      ];
      const liveIds = new Set<string>();
      for (let start = 0; start < channels.length; start += BATCH_SIZE) {
        for (const id of await this.liveStreams(
          channels.slice(start, start + BATCH_SIZE),
        )) {
          liveIds.add(id);
        }
      }

      await this.presence.updateLive(
        new Set(
          accounts
            .filter((account) => liveIds.has(account.providerAccountId))
            .map((account) => account.userId),
        ),
      );
      await this.presence.updateLiveCommunities(
        new Set(
          communities
            .filter((community) => liveIds.has(community.twitchUserId!))
            .map((community) => community.id),
        ),
      );
    } catch (error) {
      this.logger.warn(`Twitch live check failed: ${(error as Error).message}`);
    }
  }

  private credentials() {
    const clientId = oauthProviders.twitch.clientId();
    const clientSecret = oauthProviders.twitch.clientSecret();
    return clientId && clientSecret ? { clientId, clientSecret } : null;
  }

  private async liveStreams(ids: string[]) {
    const credentials = this.credentials();
    if (!credentials || ids.length === 0) return [];

    const params = new URLSearchParams({ first: String(BATCH_SIZE) });
    ids.forEach((id) => params.append('user_id', id));
    const response = await fetch(`https://api.twitch.tv/helix/streams?${params}`, {
      headers: {
        Authorization: `Bearer ${await this.token(credentials)}`,
        'Client-Id': credentials.clientId,
      },
      signal: AbortSignal.timeout(OAUTH_TIMEOUT_MS),
    });
    if (response.status === 401) this.appToken = null;
    if (!response.ok) throw new Error(`Streams request failed with ${response.status}`);

    const { data } = (await response.json()) as {
      data: { user_id: string; type: string }[];
    };
    return data
      .filter((stream) => stream.type === 'live')
      .map((stream) => stream.user_id);
  }

  private async token({
    clientId,
    clientSecret,
  }: {
    clientId: string;
    clientSecret: string;
  }) {
    if (this.appToken && this.appToken.expiresAt > Date.now()) {
      return this.appToken.value;
    }

    const response = await fetch(oauthProviders.twitch.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials',
      }),
      signal: AbortSignal.timeout(OAUTH_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Token request failed with ${response.status}`);

    const { access_token: value, expires_in: expiresIn } =
      (await response.json()) as { access_token: string; expires_in: number };
    this.appToken = {
      value,
      expiresAt: Date.now() + Math.max(expiresIn - 300, 60) * 1000,
    };
    return value;
  }
}
