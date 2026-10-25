import { ForbiddenException } from '@nestjs/common';
import { canViewProfile, requireProfileView } from './wall-access';
import { PrismaService } from '../prisma.service';
import { GUEST_USER_ID } from '../auth/allow-guest';

describe('Profile access', () => {
  const prisma = {
    friendship: { findFirst: jest.fn() },
    user: { findUnique: jest.fn() },
  };
  const db = prisma as unknown as PrismaService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.friendship.findFirst.mockResolvedValue(null);
  });

  it('shows a public profile to a guest', async () => {
    await expect(
      canViewProfile(db, GUEST_USER_ID, { id: 4, isPublic: true }),
    ).resolves.toBe(true);
  });

  it('shows a private profile to its owner', async () => {
    await expect(
      canViewProfile(db, 4, { id: 4, isPublic: false }),
    ).resolves.toBe(true);
  });

  it('shows a private profile to a friend', async () => {
    prisma.friendship.findFirst.mockResolvedValue({ requesterId: 4 });

    await expect(
      canViewProfile(db, 1, { id: 4, isPublic: false }),
    ).resolves.toBe(true);
  });

  it('hides a private profile from someone who is not a friend', async () => {
    await expect(
      canViewProfile(db, 1, { id: 4, isPublic: false }),
    ).resolves.toBe(false);
  });

  it('hides a private profile from a guest', async () => {
    await expect(
      canViewProfile(db, GUEST_USER_ID, { id: 4, isPublic: false }),
    ).resolves.toBe(false);
  });

  it('refuses a private wall to someone who is not a friend', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 4, isPublic: false });

    await expect(requireProfileView(db, 1, 4)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
