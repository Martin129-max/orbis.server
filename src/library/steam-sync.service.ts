import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { getOwnedGames, steamApiKey } from '../steam/steam-api';
import { matchSteamGames } from './library-api';
import { LibraryService } from './library.service';

const CHECK_EVERY_MS = 15 * 60 * 1000;
const MATCH_BATCH = 200;

@Injectable()
export class SteamSyncService {
  private readonly logger = new Logger(SteamSyncService.name);

  constructor(
    private prisma: PrismaService,
    private library: LibraryService,
  ) {}

  async refresh(
    userId: number,
    { waitMs = 0, force = false }: { waitMs?: number; force?: boolean } = {},
  ) {
    const run = this.sync(userId, force).catch((error: unknown) =>
      this.logger.warn(
        `Steam check failed for user ${userId}: ${error instanceof Error ? error.message : error}`,
      ),
    );
    if (waitMs > 0) {
      await Promise.race([
        run,
        new Promise((resolve) => setTimeout(resolve, waitMs)),
      ]);
    }
  }

  async sync(userId: number, force = false) {
    if (!steamApiKey()) return;

    const now = new Date();
    const claimed = await this.prisma.steamAccount.updateMany({
      where: {
        userId,
        ...(!force && {
          OR: [
            { checkedAt: null },
            { checkedAt: { lt: new Date(now.getTime() - CHECK_EVERY_MS) } },
          ],
        }),
      },
      data: { checkedAt: now },
    });
    if (claimed.count === 0) return;

    const account = await this.prisma.steamAccount.findUnique({
      where: { userId },
      select: { steamId: true, trackGames: true, baselineAt: true },
    });
    if (!account) return;

    const owned = await getOwnedGames(account.steamId);
    if (!owned) {
      await this.prisma.steamAccount.update({
        where: { userId },
        data: { gamesPrivate: true },
      });
      return;
    }

    const known = new Map(
      (
        await this.prisma.steamGame.findMany({
          where: { userId },
          select: { appId: true, minutes: true, matchedAt: true },
        })
      ).map((game) => [game.appId, game]),
    );
    const firstPlays = account.baselineAt
      ? owned.filter(
          (game) =>
            game.minutes > 0 && (known.get(game.appId)?.minutes ?? 0) === 0,
        )
      : [];
    const unmatched = new Set(
      owned
        .filter((game) => !known.get(game.appId)?.matchedAt)
        .map((game) => game.appId),
    );
    const matches = await this.match([...unmatched]);
    const matchedAt = new Date();
    const matchOf = (appId: string) =>
      unmatched.has(appId)
        ? { igdbId: matches.get(appId) ?? null, matchedAt }
        : {};

    await this.prisma.$transaction([
      this.prisma.steamGame.createMany({
        data: owned
          .filter((game) => !known.has(game.appId))
          .map((game) => ({ userId, ...game, ...matchOf(game.appId) })),
        skipDuplicates: true,
      }),
      ...owned
        .filter((game) => {
          const before = known.get(game.appId);
          return (
            before !== undefined &&
            (before.minutes !== game.minutes || unmatched.has(game.appId))
          );
        })
        .map((game) =>
          this.prisma.steamGame.update({
            where: { userId_appId: { userId, appId: game.appId } },
            data: {
              minutes: game.minutes,
              lastPlayedAt: game.lastPlayedAt,
              ...matchOf(game.appId),
            },
          }),
        ),
      this.prisma.steamAccount.update({
        where: { userId },
        data: {
          gamesPrivate: false,
          ...(!account.baselineAt && { baselineAt: now }),
        },
      }),
    ]);

    await this.prisma.$executeRaw`
      UPDATE "LibraryEntry" AS entry
      SET "steamAppId" = game."appId"
      FROM "SteamGame" AS game
      WHERE entry."userId" = ${userId}
        AND game."userId" = entry."userId"
        AND entry."mediaType" = 'game'
        AND game."igdbId" = entry."sourceId"
        AND entry."steamAppId" IS DISTINCT FROM game."appId"`;

    if (account.trackGames && firstPlays.length > 0) {
      await this.addFirstPlays(
        userId,
        firstPlays.map((game) => game.appId),
      );
    }
  }

  private async match(appIds: string[]) {
    const matches = new Map<string, string>();
    for (let start = 0; start < appIds.length; start += MATCH_BATCH) {
      const results = await matchSteamGames(
        appIds.slice(start, start + MATCH_BATCH),
      );
      for (const [appId, match] of Object.entries(results)) {
        matches.set(appId, match.sourceId);
      }
    }
    return matches;
  }

  private async addFirstPlays(userId: number, appIds: string[]) {
    const games = await this.prisma.steamGame.findMany({
      where: { userId, appId: { in: appIds }, igdbId: { not: null } },
      select: { igdbId: true },
    });
    const owned = new Set(
      (
        await this.prisma.libraryEntry.findMany({
          where: { userId, mediaType: 'game' },
          select: { sourceId: true },
        })
      ).map((entry) => entry.sourceId),
    );

    for (const { igdbId } of games) {
      if (!igdbId || owned.has(igdbId)) continue;
      try {
        await this.library.add(userId, {
          type: 'game',
          sourceId: igdbId,
          status: 'current',
        });
      } catch (error) {
        this.logger.warn(
          `Couldn’t add Steam game ${igdbId} for user ${userId}: ${error instanceof Error ? error.message : error}`,
        );
      }
    }
  }
}
