import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { CommunitiesService } from './communities.service';
import { PublicCommunitiesController } from './public-communities.controller';
import { PrismaService } from '../prisma.service';
import { StorageService } from '../storage/storage.service';
import { PresenceGateway } from '../friends/presence.gateway';
import { TwitchLiveService } from '../friends/twitch-live.service';

describe('Public landing communities', () => {
  const prisma = { community: { findMany: jest.fn() } };
  const service = new CommunitiesService(
    prisma as unknown as PrismaService,
    {} as StorageService,
    {} as PresenceGateway,
    {} as TwitchLiveService,
  );
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [PublicCommunitiesController],
      providers: [{ provide: CommunitiesService, useValue: service }],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());

  it('serves only public community metadata to guests without caching', async () => {
    prisma.community.findMany.mockResolvedValue([
      {
        id: 9,
        name: 'Reading club',
        iconUrl: null,
        coverUrl: null,
        isVerified: true,
        _count: { memberships: 3 },
      },
    ]);
    const response = await request(app.getHttpServer())
      .get('/public/communities')
      .expect(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toEqual([
      {
        id: 9,
        name: 'Reading club',
        iconUrl: null,
        coverUrl: null,
        isVerified: true,
        memberCount: 3,
      },
    ]);
    expect(prisma.community.findMany).toHaveBeenLastCalledWith({
      where: { isPublic: true },
      orderBy: [{ memberships: { _count: 'desc' } }, { id: 'desc' }],
      take: 6,
      select: {
        id: true,
        name: true,
        iconUrl: true,
        coverUrl: true,
        isVerified: true,
        _count: { select: { memberships: true } },
      },
    });
  });

  it('returns an empty list without sample communities', async () => {
    prisma.community.findMany.mockResolvedValue([]);
    const response = await request(app.getHttpServer())
      .get('/public/communities')
      .expect(200);
    expect(response.body).toEqual([]);
  });
});
