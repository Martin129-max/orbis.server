import { PrismaService } from '../prisma.service';

export type SteamLink = { appId: string; minutes: number };

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
  const rows =
    linked.length === 0
      ? []
      : await prisma.steamGame.findMany({
          where: {
            userId: { in: [...new Set(linked.map((ref) => ref.userId))] },
            appId: { in: [...new Set(linked.map((ref) => ref.appId))] },
          },
          select: { userId: true, appId: true, minutes: true },
        });
  const minutes = new Map(
    rows.map((row) => [`${row.userId}:${row.appId}`, row.minutes]),
  );

  return (userId, appId) => {
    if (!appId) return null;
    const played = minutes.get(`${userId}:${appId}`);
    return played === undefined ? null : { appId, minutes: played };
  };
}
