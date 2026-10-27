import { CommunitiesService } from './communities.service';
import { PrismaService } from '../prisma.service';
import { StorageService } from '../storage/storage.service';
import { PresenceGateway } from '../friends/presence.gateway';
import { TwitchLiveService } from '../friends/twitch-live.service';

describe('Community details', () => {
  const prisma = {
    community: { findUnique: jest.fn() },
    membership: { findUnique: jest.fn(), update: jest.fn() },
  };
  const twitch = { nextStream: jest.fn() };
  const service = new CommunitiesService(
    prisma as unknown as PrismaService,
    {} as StorageService,
    { isCommunityLive: () => false } as unknown as PresenceGateway,
    twitch as unknown as TwitchLiveService,
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
      nextStream: null,
      discord: null,
    });
    expect(twitch.nextStream).not.toHaveBeenCalled();
  });

  it('includes the next scheduled stream for a community linked to Twitch', async () => {
    const nextStream = {
      startsAt: '2026-10-27T18:00:00Z',
      endsAt: '2026-10-27T20:00:00Z',
      title: 'Watch party',
    };
    prisma.community.findUnique.mockResolvedValue({
      id: 9,
      name: 'Reading club',
      isPublic: true,
      twitchUserId: '141981764',
      _count: { memberships: 3 },
    });
    prisma.membership.findUnique.mockResolvedValue(null);
    twitch.nextStream.mockResolvedValue(nextStream);

    await expect(service.findOne(1, 9)).resolves.toMatchObject({ nextStream });
    expect(twitch.nextStream).toHaveBeenCalledWith('141981764');
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

  it('tells a member whether their library updates show there', async () => {
    prisma.community.findUnique.mockResolvedValue({
      id: 9,
      name: 'Reading club',
      isPublic: true,
      _count: { memberships: 3 },
    });
    prisma.membership.findUnique.mockResolvedValue({
      community: { ownerId: 2 },
      roles: [],
      showLibraryUpdates: false,
    });

    await expect(service.findOne(1, 9)).resolves.toMatchObject({
      role: 'member',
      showLibraryUpdates: false,
    });
  });

  it('saves whether a member’s library updates show in the community', async () => {
    prisma.membership.update.mockResolvedValue({ showLibraryUpdates: false });

    await expect(service.setShowLibraryUpdates(4, 9, false)).resolves.toEqual({
      showLibraryUpdates: false,
    });
    expect(prisma.membership.update).toHaveBeenCalledWith({
      where: { userId_communityId: { userId: 4, communityId: 9 } },
      data: { showLibraryUpdates: false },
      select: { showLibraryUpdates: true },
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
