import { CommunitiesService } from './communities.service';
import { PrismaService } from '../prisma.service';
import { StorageService } from '../storage/storage.service';
import { PresenceGateway } from '../friends/presence.gateway';

describe('Community details', () => {
  const prisma = {
    community: { findUnique: jest.fn() },
    membership: { findUnique: jest.fn(), update: jest.fn() },
  };
  const service = new CommunitiesService(
    prisma as unknown as PrismaService,
    {} as StorageService,
    { isCommunityLive: () => false } as unknown as PresenceGateway,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns public community details to a non-member', async () => {
    prisma.community.findUnique.mockResolvedValue({
      id: 9,
      name: 'Reading club',
      isPublic: true,
      _count: { memberships: 3 },
    });
    prisma.membership.findUnique.mockResolvedValue(null);

    await expect(service.findOne(1, 9)).resolves.toEqual({
      id: 9,
      name: 'Reading club',
      isPublic: true,
      role: null,
      memberCount: 3,
      live: false,
    });
  });

  it('does not return private community details to a non-member', async () => {
    prisma.community.findUnique.mockResolvedValue({
      id: 9,
      name: 'Reading club',
      isPublic: false,
      _count: { memberships: 3 },
    });
    prisma.membership.findUnique.mockResolvedValue(null);

    await expect(service.findOne(1, 9)).resolves.toBeNull();
  });

  it('returns member role for an existing member', async () => {
    prisma.community.findUnique.mockResolvedValue({
      id: 9,
      name: 'Reading club',
      isPublic: true,
      _count: { memberships: 3 },
    });
    prisma.membership.findUnique.mockResolvedValue({
      community: { ownerId: 2 },
      roles: [],
    });

    await expect(service.findOne(1, 9)).resolves.toMatchObject({
      id: 9,
      role: 'member',
    });
  });

  it('saves a trimmed nickname for the member', async () => {
    prisma.membership.update.mockResolvedValue({ nickname: 'Navigator' });

    await service.setNickname(4, 9, '  Navigator  ');

    expect(prisma.membership.update).toHaveBeenCalledWith({
      where: { userId_communityId: { userId: 4, communityId: 9 } },
      data: { nickname: 'Navigator' },
      select: { nickname: true },
    });
  });

  it('clears a blank nickname', async () => {
    prisma.membership.update.mockResolvedValue({ nickname: null });

    await service.setNickname(4, 9, '   ');

    expect(prisma.membership.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { nickname: null } }),
    );
  });
});
