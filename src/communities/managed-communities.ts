import { PrismaService } from '../prisma.service';
import { isAdministrator } from './permissions';

export async function managedCommunities(
  prisma: PrismaService,
  userId: number,
  communityIds: (number | null)[],
): Promise<Set<number>> {
  const ids = [
    ...new Set(communityIds.filter((id): id is number => id !== null)),
  ];
  if (ids.length === 0) return new Set();

  const memberships = await prisma.membership.findMany({
    where: { userId, communityId: { in: ids } },
    select: {
      communityId: true,
      community: { select: { ownerId: true } },
      roles: { select: { role: { select: { permissions: true } } } },
    },
  });
  return new Set(
    memberships
      .filter(
        ({ community, roles }) =>
          community.ownerId === userId ||
          roles.some(({ role }) => isAdministrator(role.permissions)),
      )
      .map(({ communityId }) => communityId),
  );
}
