import { PrismaService } from '../prisma.service';

type AuthorRef = { communityId: number | null; userId: number };

export type WithNickname = <A extends { id: number }>(
  communityId: number | null,
  author: A,
) => A & { nickname: string | null };

export async function loadNicknames(
  prisma: PrismaService,
  refs: AuthorRef[],
): Promise<WithNickname> {
  const communityIds = new Set<number>();
  const userIds = new Set<number>();
  for (const { communityId, userId } of refs) {
    if (communityId === null) continue;
    communityIds.add(communityId);
    userIds.add(userId);
  }

  const rows =
    communityIds.size === 0
      ? []
      : await prisma.membership.findMany({
          where: {
            communityId: { in: [...communityIds] },
            userId: { in: [...userIds] },
            nickname: { not: null },
          },
          select: { communityId: true, userId: true, nickname: true },
        });
  const nicknames = new Map(
    rows.map((row) => [`${row.communityId}:${row.userId}`, row.nickname]),
  );

  return (communityId, author) => ({
    ...author,
    nickname:
      communityId === null
        ? null
        : (nicknames.get(`${communityId}:${author.id}`) ?? null),
  });
}
