import { ForbiddenException } from '@nestjs/common';
import { requireViewAccess } from './require-membership';
import { PrismaService } from '../prisma.service';

describe('requireViewAccess', () => {
  const prisma = { community: { findUnique: jest.fn() } };
  const check = () =>
    requireViewAccess(prisma as unknown as PrismaService, 1, 9);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lets a non-member view a public community', async () => {
    prisma.community.findUnique.mockResolvedValue({
      isPublic: true,
      memberships: [],
    });

    await expect(check()).resolves.toBeUndefined();
  });

  it('lets a member view a private community', async () => {
    prisma.community.findUnique.mockResolvedValue({
      isPublic: false,
      memberships: [{ userId: 1 }],
    });

    await expect(check()).resolves.toBeUndefined();
  });

  it('blocks a non-member from a private community', async () => {
    prisma.community.findUnique.mockResolvedValue({
      isPublic: false,
      memberships: [],
    });

    await expect(check()).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks a community that does not exist', async () => {
    prisma.community.findUnique.mockResolvedValue(null);

    await expect(check()).rejects.toBeInstanceOf(ForbiddenException);
  });
});
