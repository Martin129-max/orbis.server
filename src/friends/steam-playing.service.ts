import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { getPlayingGames, steamApiKey } from '../steam/steam-api';
import { PrismaService } from '../prisma.service';
import { PresenceGateway } from './presence.gateway';

const POLL_MS = 60_000;
const BATCH_SIZE = 100;

@Injectable()
export class SteamPlayingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SteamPlayingService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private prisma: PrismaService,
    private presence: PresenceGateway,
  ) {}

  onModuleInit() {
    if (!steamApiKey()) return;
    this.timer = setInterval(() => void this.poll(), POLL_MS);
    this.timer.unref();
    void this.poll();
  }

  onModuleDestroy() {
    clearInterval(this.timer);
  }

  async poll() {
    try {
      const accounts = await this.prisma.steamAccount.findMany({
        where: { showPlaying: true },
        select: { userId: true, steamId: true },
      });

      const playing = new Map<number, string>();
      for (let start = 0; start < accounts.length; start += BATCH_SIZE) {
        const batch = accounts.slice(start, start + BATCH_SIZE);
        const games = await getPlayingGames(
          batch.map((account) => account.steamId),
        );
        for (const account of batch) {
          const game = games.get(account.steamId);
          if (game) playing.set(account.userId, game);
        }
      }

      await this.presence.updatePlaying(playing);
    } catch (error) {
      this.logger.warn(
        `Steam playing check failed: ${(error as Error).message}`,
      );
    }
  }
}
