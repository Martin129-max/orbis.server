import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PostsService } from './posts.service';
import { PrismaService } from '../prisma.service';
import { ThreadsService } from '../threads/threads.service';
import { NotificationsService } from '../notifications/notifications.service';
import { LikesService } from '../likes/likes.service';

jest.mock('../common/rich-text', () => ({ sanitizeRichText: jest.fn() }));

const date = new Date('2026-10-24T12:00:00Z');
const person = { id: 1, username: 'reader', name: null, avatarUrl: null };
const post = {
  id: 1,
  createdAt: date,
  commentCount: 0,
  content: 'Post',
  author: person,
};
const thread = {
  id: 2,
  createdAt: date,
  commentCount: 0,
  title: 'Thread',
  author: person,
};
const activity = {
  id: 3,
  createdAt: date,
  commentCount: 0,
  progressTo: null,
  status: 'current',
  entry: {
    mediaType: 'anime',
    sourceId: '1',
    title: 'Title',
    coverImage: null,
    year: null,
    user: person,
  },
};

describe('Feed content filters', () => {
  const prisma = {
    post: { findMany: jest.fn() },
    thread: { findMany: jest.fn() },
    libraryActivity: { findMany: jest.fn() },
    contentReport: { findMany: jest.fn() },
    user: { findUnique: jest.fn() },
    friendship: { findFirst: jest.fn() },
    membership: { findMany: jest.fn() },
  };
  const threads = { withMyVotes: jest.fn() };
  const likes = { likedBy: jest.fn() };
  const service = new PostsService(
    prisma as unknown as PrismaService,
    threads as unknown as ThreadsService,
    {} as NotificationsService,
    likes as unknown as LikesService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.post.findMany.mockResolvedValue([post]);
    prisma.thread.findMany.mockResolvedValue([thread]);
    prisma.libraryActivity.findMany.mockResolvedValue([activity]);
    prisma.contentReport.findMany.mockResolvedValue([]);
    prisma.user.findUnique.mockResolvedValue(person);
    prisma.friendship.findFirst.mockResolvedValue(null);
    prisma.membership.findMany.mockResolvedValue([]);
    threads.withMyVotes.mockImplementation((_userId, items) =>
      Promise.resolve(items),
    );
    likes.likedBy.mockResolvedValue(new Set());
  });

  it('includes all types by default', async () => {
    const result = await service.findForMember(1);
    expect(result.items.map((item) => item.type)).toEqual([
      'activity',
      'thread',
      'post',
    ]);
  });

  it('can hide library updates and threads together', async () => {
    const result = await service.findForMember(1, undefined, 'activity,thread');
    expect(result.items.map((item) => item.type)).toEqual(['post']);
    expect(prisma.libraryActivity.findMany).not.toHaveBeenCalled();
    expect(prisma.thread.findMany).not.toHaveBeenCalled();
  });

  it('can show only library updates', async () => {
    expect(
      (await service.findForMember(1, undefined, 'post,thread')).items.map(
        (item) => item.type,
      ),
    ).toEqual(['activity']);
    expect(prisma.post.findMany).not.toHaveBeenCalled();
    expect(prisma.thread.findMany).not.toHaveBeenCalled();
  });

  it('can hide all types', async () => {
    expect(
      await service.findForMember(1, undefined, 'post,thread,activity'),
    ).toEqual({ items: [], nextCursor: null });
    expect(prisma.post.findMany).not.toHaveBeenCalled();
    expect(prisma.thread.findMany).not.toHaveBeenCalled();
    expect(prisma.libraryActivity.findMany).not.toHaveBeenCalled();
  });

  it.each(['activity,unknown', 'post,,thread', 'constructor'])(
    'rejects invalid filter %s',
    async (filter) => {
      await expect(
        service.findForMember(1, undefined, filter),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.post.findMany).not.toHaveBeenCalled();
    },
  );

  it('filters community feeds before pagination', async () => {
    expect(
      (await service.findForCommunity(1, 9, undefined, 'activity')).items.map(
        (item) => item.type,
      ),
    ).toEqual(['post']);
    expect(prisma.libraryActivity.findMany).not.toHaveBeenCalled();
  });

  it('filters profile feeds', async () => {
    expect(
      (
        await service.findForProfile(1, 'reader', undefined, 'thread,activity')
      ).items.map((item) => item.type),
    ).toEqual(['post']);
    expect(prisma.thread.findMany).not.toHaveBeenCalled();
    expect(prisma.libraryActivity.findMany).not.toHaveBeenCalled();
  });

  it('filters title-page posts', async () => {
    expect(
      await service.findForMedia(1, 'anime', '1', undefined, 'post'),
    ).toEqual({ items: [], nextCursor: null });
    expect(prisma.post.findMany).not.toHaveBeenCalled();
  });

  it('paginates matching items even when other types dominate the feed', async () => {
    prisma.post.findMany.mockResolvedValue(
      Array.from({ length: 11 }, (_, index) => ({ ...post, id: 11 - index })),
    );
    const first = await service.findForMember(1, undefined, 'activity,thread');
    expect(first.items).toHaveLength(10);
    expect(first.nextCursor).toBe(`${date.getTime()}_0_2`);
    prisma.post.findMany.mockResolvedValue([{ ...post, id: 1 }]);
    const second = await service.findForMember(
      1,
      first.nextCursor!,
      'activity,thread',
    );
    expect(second.items).toHaveLength(1);
    expect(second.nextCursor).toBeNull();
    const where = prisma.post.findMany.mock.calls[1][0].where;
    expect(where.AND).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ wallUserId: 1 }),
          ]),
        }),
        expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ id: { lt: 2 } }),
          ]),
        }),
      ]),
    );
  });

  it('retains profile visibility conditions when paging filtered posts', async () => {
    await service.findForProfile(
      1,
      'reader',
      `${date.getTime()}_0_2`,
      'activity,thread',
    );
    const where = prisma.post.findMany.mock.calls[0][0].where;
    expect(where.AND[0].OR).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          authorId: person.id,
          community: expect.any(Object),
        }),
      ]),
    );
    expect(where.AND[1].OR).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: { lt: 2 } })]),
    );
  });

  it('searches only the posts and threads a profile shows', async () => {
    const result = await service.searchProfile(1, 'reader', ' Post ');

    expect(result.map((item) => item.type)).toEqual(['thread', 'post']);
    const postWhere = prisma.post.findMany.mock.calls[0][0].where;
    expect(postWhere.AND[0].OR).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ wallUserId: person.id }),
        expect.objectContaining({
          authorId: person.id,
          community: expect.any(Object),
        }),
      ]),
    );
    expect(postWhere.AND[1]).toEqual({
      content: { contains: 'Post', mode: 'insensitive' },
    });
    expect(prisma.thread.findMany.mock.calls[0][0].where).toEqual(
      expect.objectContaining({
        authorId: person.id,
        community: expect.any(Object),
      }),
    );
  });

  it('shows community authors by their nickname there', async () => {
    prisma.post.findMany.mockResolvedValue([{ ...post, communityId: 5 }]);
    prisma.membership.findMany.mockResolvedValue([
      { communityId: 5, userId: person.id, nickname: 'Navigator' },
    ]);

    const { items } = await service.findForCommunity(
      1,
      5,
      undefined,
      'thread,activity',
    );

    expect(items[0].author).toEqual({ ...person, nickname: 'Navigator' });
  });

  it('hides 18+ library updates unless the viewer turned NSFW on', async () => {
    await service.findForMember(1);
    expect(
      prisma.libraryActivity.findMany.mock.calls[0][0].where.entry,
    ).toMatchObject({ isAdult: false });

    prisma.user.findUnique.mockResolvedValue({ ...person, showNsfw: true });
    await service.findForMember(1);
    expect(
      prisma.libraryActivity.findMany.mock.calls[1][0].where.entry,
    ).not.toHaveProperty('isAdult');
  });

  it('waits for at least two characters before searching a profile', async () => {
    expect(await service.searchProfile(1, 'reader', 'a')).toEqual([]);
    expect(prisma.post.findMany).not.toHaveBeenCalled();
    expect(prisma.thread.findMany).not.toHaveBeenCalled();
  });

  it('refuses to search a private profile you can’t see', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 4, isPublic: false });

    await expect(service.searchProfile(1, 'secret', 'Post')).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.post.findMany).not.toHaveBeenCalled();
  });
});

describe('Creating posts with a link card', () => {
  const create = jest.fn(({ data }) => ({ id: 9, ...data, author: person }));
  const service = new PostsService(
    {
      post: { create },
      membership: { findMany: jest.fn().mockResolvedValue([]) },
    } as unknown as PrismaService,
    {} as ThreadsService,
    {} as NotificationsService,
    {} as LikesService,
  );
  const sanitize = jest.requireMock('../common/rich-text')
    .sanitizeRichText as jest.Mock;

  beforeEach(() => jest.clearAllMocks());

  it('saves the link alongside the text', async () => {
    sanitize.mockReturnValue({ html: '<p>Watch this</p>', empty: false });

    await service.create(3, 1, {
      content: '<p>Watch this</p>',
      linkUrl: 'https://youtu.be/dQw4w9WgXcQ',
    });

    expect(create.mock.calls[0][0].data).toMatchObject({
      content: '<p>Watch this</p>',
      linkUrl: 'https://youtu.be/dQw4w9WgXcQ',
    });
  });

  it('allows a post that is only a link card', async () => {
    sanitize.mockReturnValue({ html: '<p></p>', empty: true });

    await service.create(3, 1, {
      content: '<p></p>',
      linkUrl: 'https://example.com',
    });

    expect(create.mock.calls[0][0].data).toMatchObject({
      content: '',
      linkUrl: 'https://example.com',
    });
  });

  it('still rejects empty posts without a link', async () => {
    sanitize.mockReturnValue({ html: '<p></p>', empty: true });

    await expect(
      service.create(3, 1, { content: '<p></p>' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });
});
