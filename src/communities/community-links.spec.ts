import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CommunitiesService } from './communities.service';
import { UpdateCommunityDto } from './dto/update-community.dto';
import { PrismaService } from '../prisma.service';
import { StorageService } from '../storage/storage.service';
import { PresenceGateway } from '../friends/presence.gateway';
import { TwitchLiveService } from '../friends/twitch-live.service';

async function linkErrors(links: Record<string, string>) {
  const errors = await validate(
    plainToInstance(UpdateCommunityDto, { links }),
    {
      whitelist: true,
    },
  );
  return errors.flatMap((error) =>
    (error.children ?? []).map((child) => child.property),
  );
}

describe('Community links', () => {
  it('accepts links on each platform', async () => {
    await expect(
      linkErrors({
        x: 'https://x.com/seasonalclub',
        youtube: 'https://www.youtube.com/@seasonalclub',
        kick: 'https://kick.com/seasonalclub',
        instagram: 'https://www.instagram.com/seasonalclub/',
        tiktok: 'https://www.tiktok.com/@seasonalclub',
        reddit: 'https://www.reddit.com/r/seasonalclub',
        website: 'https://seasonal.example.com',
      }),
    ).resolves.toEqual([]);
    await expect(
      linkErrors({
        x: 'https://twitter.com/seasonalclub',
        youtube: 'https://youtu.be/abc123',
      }),
    ).resolves.toEqual([]);
  });

  it('refuses links to another site', async () => {
    await expect(
      linkErrors({
        x: 'https://x.com.example.com/seasonalclub',
        youtube: 'https://notyoutube.com/@seasonalclub',
        kick: 'https://kick.com@example.com',
        instagram: 'http://instagram.com/seasonalclub',
        tiktok: 'javascript:alert(1)//tiktok.com',
      }),
    ).resolves.toEqual(['x', 'youtube', 'kick', 'instagram', 'tiktok']);
  });

  it('refuses a website that isn’t a web link', async () => {
    await expect(
      linkErrors({ website: 'javascript:alert(1)' }),
    ).resolves.toEqual(['website']);
    await expect(linkErrors({ website: 'seasonal' })).resolves.toEqual([
      'website',
    ]);
  });

  it('saves the links', async () => {
    const prisma = {
      membership: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ community: { ownerId: 1 }, roles: [] }),
      },
      community: {
        update: jest.fn().mockResolvedValue({ id: 9, name: 'Reading club' }),
      },
    };
    const service = new CommunitiesService(
      prisma as unknown as PrismaService,
      {} as StorageService,
      {} as PresenceGateway,
      {} as TwitchLiveService,
    );

    await service.update(1, 9, { links: { kick: 'https://kick.com/club' } });

    expect(prisma.community.update).toHaveBeenCalledWith({
      where: { id: 9 },
      data: expect.objectContaining({
        links: { kick: 'https://kick.com/club' },
      }),
    });
  });
});
