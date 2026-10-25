import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

export async function requireMembership(
  prisma: PrismaService,
  userId: number,
  communityId: number,
) {
  const membership = await prisma.membership.findUnique({
    where: { userId_communityId: { userId, communityId } },
    select: { userId: true },
  });

  if (!membership) {
    throw new ForbiddenException('You are not a member of this community');
  }
}

export async function requireViewAccess(
  prisma: PrismaService,
  userId: number,
  communityId: number,
) {
  const community = await prisma.community.findUnique({
    where: { id: communityId },
    select: {
      isPublic: true,
      memberships: { where: { userId }, select: { userId: true } },
    },
  });

  if (!community?.isPublic && !community?.memberships.length) {
    throw new ForbiddenException('You are not a member of this community');
  }
}
