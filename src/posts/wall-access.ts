import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '../../prisma/generated/client';
import { requireMembership } from '../communities/require-membership';

export function friendsOf(userId: number): Prisma.UserWhereInput {
  return {
    OR: [
      {
        sentFriendships: { some: { addresseeId: userId, status: 'accepted' } },
      },
      {
        receivedFriendships: {
          some: { requesterId: userId, status: 'accepted' },
        },
      },
    ],
  };
}

export async function requireWallAccess(
  prisma: PrismaService,
  userId: number,
  wallUserId: number,
) {
  if (userId === wallUserId) return;

  const friendship = await prisma.friendship.findFirst({
    where: {
      status: 'accepted',
      OR: [
        { requesterId: userId, addresseeId: wallUserId },
        { requesterId: wallUserId, addresseeId: userId },
      ],
    },
    select: { requesterId: true },
  });

  if (!friendship) {
    throw new ForbiddenException('Only friends can join in on this wall');
  }
}

export async function requirePostAccess(
  prisma: PrismaService,
  userId: number,
  {
    communityId,
    wallUserId,
  }: { communityId: number | null; wallUserId: number | null },
) {
  if (communityId !== null) {
    await requireMembership(prisma, userId, communityId);
  } else if (wallUserId !== null) {
    await requireWallAccess(prisma, userId, wallUserId);
  } else {
    throw new NotFoundException('Not found');
  }
}
