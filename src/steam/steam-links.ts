import { PrismaService } from '../prisma.service';

export type SteamLink = {
  appId: string;
  minutes: number;
  steamId: string;
  achievements: { achieved: number; total: number } | null;
};

type SteamRef = { userId: number; appId: string | null };

export type SteamLinkOf = (
  userId: number,
  appId: string | null,
) => SteamLink | null;

export async function loadSteamLinks(
  prisma: PrismaService,
  refs: SteamRef[],
): Promise<SteamLinkOf> {
  const linked = refs.filter(
    (ref): ref is { userId: number; appId: string } =>
      typeof ref.appId === 'string',
  );
  const userIds = [...new Set(linked.map((ref) => ref.userId))];
  const [rows, accounts] =
    linked.length === 0
      ? [[], []]
      : await Promise.all([
          prisma.steamGame.findMany({
            where: {
              userId: { in: userIds },
              appId: { in: [...new Set(linked.map((ref) => ref.appId))] },
            },
            select: {
              userId: true,
              appId: true,
              minutes: true,
              achieved: true,
              achievementTotal: true,
            },
          }),
          prisma.steamAccount.findMany({
            where: { userId: { in: userIds } },
            select: { userId: true, steamId: true },
          }),
        ]);
  const games = new Map(rows.map((row) => [`${row.userId}:${row.appId}`, row]));
  const steamIds = new Map(
    accounts.map((account) => [account.userId, account.steamId]),
  );

  return (userId, appId) => {
    if (!appId) return null;
    const game = games.get(`${userId}:${appId}`);
    const steamId = steamIds.get(userId);
    if (!game || !steamId) return null;
    return {
      appId,
      minutes: game.minutes,
      steamId,
      achievements: game.achievementTotal
        ? { achieved: game.achieved ?? 0, total: game.achievementTotal }
        : null,
    };
  };
}
