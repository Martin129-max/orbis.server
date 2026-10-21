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
