import { GUEST_USER_ID } from '../auth/allow-guest';
import { PrismaService } from '../prisma.service';

export async function showsNsfw(prisma: PrismaService, userId: number) {
  if (userId === GUEST_USER_ID) return false;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { showNsfw: true },
  });
  return user?.showNsfw ?? false;
}

export function nsfwEntries(showNsfw: boolean) {
  return showNsfw ? {} : { isAdult: false };
}
