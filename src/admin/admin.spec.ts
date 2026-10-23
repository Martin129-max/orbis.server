import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService, DIRECTORY_PAGE_SIZE } from './admin.service';
import { SiteAdminGuard } from './site-admin.guard';
import { PrismaService } from '../prisma.service';
import { MAX_INT } from '../communities/community-member.guard';

describe('Admin directory', () => {
  const headAdmin = process.env.HEAD_ADMIN;
  const prisma = {
    user: { findUnique: jest.fn(), count: jest.fn(), findMany: jest.fn() },
    community: { count: jest.fn(), findMany: jest.fn() },
    $transaction: jest.fn((queries) => Promise.all(queries)),
  };
  const service = new AdminService(prisma as unknown as PrismaService);
  const guard = new SiteAdminGuard(prisma as unknown as PrismaService);
  const context = {
    switchToHttp: () => ({ getRequest: () => ({ user: { userId: 7 } }) }),
  } as ExecutionContext;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.HEAD_ADMIN = 'head@example.test';
  });

  afterAll(() => {
    if (headAdmin === undefined) delete process.env.HEAD_ADMIN;
    else process.env.HEAD_ADMIN = headAdmin;
  });

  it.each([
    { isAdmin: true, email: 'admin@example.test' },
    { isAdmin: false, email: 'HEAD@example.test' },
  ])('allows site and head admins: %j', async (user) => {
    prisma.user.findUnique.mockResolvedValue(user);
    expect(await guard.canActivate(context)).toBe(true);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 7 },
      select: { isAdmin: true, email: true },
    });
  });

  it.each([null, { isAdmin: false, email: 'member@example.test' }])(
    'rejects missing users and ordinary members: %j',
    async (user) => {
      prisma.user.findUnique.mockResolvedValue(user);
      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    },
  );

  it('returns the requested user page with counts and head-admin status', async () => {
    prisma.user.count.mockResolvedValue(30);
    prisma.user.findMany.mockResolvedValue([
      {
        id: 7,
        email: 'head@example.test',
        isAdmin: false,
        username: 'head',
        _count: { memberships: 4 },
      },
    ]);
    expect(await service.users(2)).toMatchObject({
      total: 30,
      page: 2,
      pageSize: 20,
      items: [
        { userId: 7, isAdmin: true, isHeadAdmin: true, communityCount: 4 },
      ],
    });
    const query = prisma.user.findMany.mock.calls[0][0];
    expect(query.skip).toBe(20);
    expect(query.take).toBe(20);
    expect(query.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
    expect(query.select.password).toBeUndefined();
  });

  it('includes private communities with owner and membership counts', async () => {
    prisma.community.count.mockResolvedValue(1);
    prisma.community.findMany.mockResolvedValue([
      {
        id: 3,
        name: 'Private club',
        isPublic: false,
        owner: { username: 'owner' },
        _count: { memberships: 5 },
      },
    ]);
    expect(await service.communities(1)).toMatchObject({
      total: 1,
      page: 1,
      pageSize: 20,
      items: [
        {
          id: 3,
          isPublic: false,
          memberCount: 5,
          owner: { username: 'owner' },
        },
      ],
    });
    expect(prisma.community.findMany.mock.calls[0][0].where).toBeUndefined();
  });

  it('normalizes low pages and bounds database offsets for both lists', async () => {
    const api = { users: jest.fn(), communities: jest.fn() };
    const controller = new AdminController(api as unknown as AdminService);
    controller.users(-2);
    expect(api.users).toHaveBeenLastCalledWith(1);
    controller.communities(Number.MAX_SAFE_INTEGER);
    const page = api.communities.mock.calls[0][0];
    expect((page - 1) * DIRECTORY_PAGE_SIZE).toBeLessThanOrEqual(MAX_INT);
  });
});
