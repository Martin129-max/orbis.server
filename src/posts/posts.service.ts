import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { normalizeUsername } from '../users/username';
import { MAX_INT } from '../communities/community-member.guard';
import { PrismaService } from '../prisma.service';
import { LibraryStatus, Prisma } from '../../prisma/generated/client';
import { author, communitySummary } from '../common/author';
import { PAGE_SIZE, Page } from '../common/pagination';
import { sanitizeRichText } from '../common/rich-text';
import {
  ThreadSummary,
  ThreadsService,
  threadInclude,
} from '../threads/threads.service';
import { CreatePostDto } from './dto/create-post.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { friendsOf, requireWallAccess } from './wall-access';

const postInclude = {
  author,
  community: communitySummary,
  wallUser: author,
} as const;

export type PostItem = Prisma.PostGetPayload<{
  include: typeof postInclude;
}> & { type: 'post' };

const activityInclude = {
  entry: {
    select: {
      mediaType: true,
      sourceId: true,
      title: true,
      coverImage: true,
      year: true,
      user: author,
    },
  },
} as const;

export type ActivityItem = {
  type: 'activity';
  id: number;
  createdAt: Date;
  author: Prisma.UserGetPayload<typeof author>;
  status: LibraryStatus;
  progress: { from: number; to: number } | null;
  media: {
    type: 'anime' | 'manga' | 'game';
    sourceId: string;
    title: string;
    coverImage: string | null;
    year: number | null;
  };
};

export type FeedItem = PostItem | ThreadSummary | ActivityItem;

const RANK = { post: 0, thread: 1, activity: 2 } as const;

type FeedCursor = { createdAt: Date; rank: number; id: number };

const newestFirst = [{ createdAt: 'desc' as const }, { id: 'desc' as const }];

function parseFeedCursor(raw?: string): FeedCursor | undefined {
  if (raw === undefined) return undefined;

  const match = /^(\d{1,15})_([012])_(\d{1,10})$/.exec(raw);
  const id = Number(match?.[3]);
  if (!match || id < 1 || id > MAX_INT) {
    throw new BadRequestException('Invalid cursor');
  }

  return {
    createdAt: new Date(Number(match[1])),
    rank: Number(match[2]),
    id,
  };
}

function olderThan(cursor: FeedCursor | undefined, rank: number) {
  if (!cursor) return {};
  if (rank < cursor.rank) return { createdAt: { lte: cursor.createdAt } };
  if (rank > cursor.rank) return { createdAt: { lt: cursor.createdAt } };
  return {
    OR: [
      { createdAt: { lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, id: { lt: cursor.id } },
    ],
  };
}

type Sortable = { createdAt: Date; type: keyof typeof RANK; id: number };

function compareFeedItems(a: Sortable, b: Sortable) {
  return (
    b.createdAt.getTime() - a.createdAt.getTime() ||
    RANK[b.type] - RANK[a.type] ||
    b.id - a.id
  );
}

function toActivity(
  activity: Prisma.LibraryActivityGetPayload<{
    include: typeof activityInclude;
  }>,
): ActivityItem {
  const { entry } = activity;
  return {
    type: 'activity',
    id: activity.id,
    createdAt: activity.createdAt,
    author: entry.user,
    status: activity.status,
    progress:
      activity.progressTo === null
        ? null
        : { from: activity.progressFrom!, to: activity.progressTo },
    media: {
      type: entry.mediaType,
      sourceId: entry.sourceId,
      title: entry.title,
      coverImage: entry.coverImage,
      year: entry.year,
    },
  };
}

function nextCursor<T extends Sortable>(merged: T[], page: T[]) {
  const last = page[page.length - 1];
  return merged.length > PAGE_SIZE
    ? `${last.createdAt.getTime()}_${RANK[last.type]}_${last.id}`
    : null;
}

@Injectable()
export class PostsService {
  constructor(
    private prisma: PrismaService,
    private threads: ThreadsService,
    private notifications: NotificationsService,
  ) {}

  async findForCommunity(
    communityId: number,
    rawCursor?: string,
  ): Promise<Page<PostItem | ActivityItem>> {
    const cursor = parseFeedCursor(rawCursor);

    const [posts, activities] = await Promise.all([
      this.prisma.post.findMany({
        where: { communityId, ...olderThan(cursor, RANK.post) },
        orderBy: newestFirst,
        take: PAGE_SIZE + 1,
        include: postInclude,
      }),
      this.prisma.libraryActivity.findMany({
        where: {
          entry: {
            isPublic: true,
            user: { memberships: { some: { communityId } } },
          },
          ...olderThan(cursor, RANK.activity),
        },
        orderBy: newestFirst,
        take: PAGE_SIZE + 1,
        include: activityInclude,
      }),
    ]);

    const merged = [
      ...posts.map((post) => ({ ...post, type: 'post' as const })),
      ...activities.map(toActivity),
    ].sort(compareFeedItems);
    const items = merged.slice(0, PAGE_SIZE);

    return { items, nextCursor: nextCursor(merged, items) };
  }

  async findForMember(
    userId: number,
    rawCursor?: string,
  ): Promise<Page<FeedItem>> {
    const cursor = parseFeedCursor(rawCursor);
    const member = { community: { memberships: { some: { userId } } } };

    const [posts, threads, activities] = await Promise.all([
      this.prisma.post.findMany({
        where: {
          OR: [
            member,
            { wallUserId: userId },
            { authorId: userId, communityId: null },
            { wallUser: friendsOf(userId) },
          ],
          ...olderThan(cursor, RANK.post),
        },
        orderBy: newestFirst,
        take: PAGE_SIZE + 1,
        include: postInclude,
      }),
      this.prisma.thread.findMany({
        where: { ...member, ...olderThan(cursor, RANK.thread) },
        orderBy: newestFirst,
        take: PAGE_SIZE + 1,
        include: threadInclude,
      }),
      this.prisma.libraryActivity.findMany({
        where: {
          entry: {
            isPublic: true,
            user: {
              memberships: {
                some: { community: { memberships: { some: { userId } } } },
              },
            },
          },
          ...olderThan(cursor, RANK.activity),
        },
        orderBy: newestFirst,
        take: PAGE_SIZE + 1,
        include: activityInclude,
      }),
    ]);

    const merged = [
      ...posts.map((post) => ({ ...post, type: 'post' as const })),
      ...threads.map((thread) => ({ ...thread, type: 'thread' as const })),
      ...activities.map(toActivity),
    ].sort(compareFeedItems);
    const page = merged.slice(0, PAGE_SIZE);
    const voted = new Map(
      (
        await this.threads.withMyVotes(
          userId,
          page.flatMap((item) => (item.type === 'thread' ? [item] : [])),
        )
      ).map((thread) => [thread.id, thread]),
    );
    const items: FeedItem[] = page.map((item) =>
      item.type === 'thread' ? voted.get(item.id)! : item,
    );

    return { items, nextCursor: nextCursor(merged, page) };
  }

  async findForProfile(
    viewerId: number,
    username: string,
    rawCursor?: string,
  ): Promise<Page<FeedItem>> {
    const cursor = parseFeedCursor(rawCursor);
    const owner = await this.prisma.user.findUnique({
      where: { username: normalizeUsername(username) },
      select: { id: true },
    });
    if (!owner) throw new NotFoundException('User not found');

    const visibleCommunity = {
      OR: [{ isPublic: true }, { memberships: { some: { userId: viewerId } } }],
    };
    const [posts, threads, activities] = await Promise.all([
      this.prisma.post.findMany({
        where: {
          OR: [
            { wallUserId: owner.id },
            { authorId: owner.id, communityId: null },
            { authorId: owner.id, community: visibleCommunity },
          ],
          ...olderThan(cursor, RANK.post),
        },
        orderBy: newestFirst,
        take: PAGE_SIZE + 1,
        include: postInclude,
      }),
      this.prisma.thread.findMany({
        where: {
          authorId: owner.id,
          community: visibleCommunity,
          ...olderThan(cursor, RANK.thread),
        },
        orderBy: newestFirst,
        take: PAGE_SIZE + 1,
        include: threadInclude,
      }),
      this.prisma.libraryActivity.findMany({
        where: {
          entry: { userId: owner.id, isPublic: true },
          ...olderThan(cursor, RANK.activity),
        },
        orderBy: newestFirst,
        take: PAGE_SIZE + 1,
        include: activityInclude,
      }),
    ]);

    const merged = [
      ...posts.map((post) => ({ ...post, type: 'post' as const })),
      ...threads.map((thread) => ({ ...thread, type: 'thread' as const })),
      ...activities.map(toActivity),
    ].sort(compareFeedItems);
    const page = merged.slice(0, PAGE_SIZE);
    const voted = new Map(
      (
        await this.threads.withMyVotes(
          viewerId,
          page.flatMap((item) => (item.type === 'thread' ? [item] : [])),
        )
      ).map((thread) => [thread.id, thread]),
    );
    const items: FeedItem[] = page.map((item) =>
      item.type === 'thread' ? voted.get(item.id)! : item,
    );

    return { items, nextCursor: nextCursor(merged, page) };
  }

  async createOnWall(
    username: string,
    authorId: number,
    { content }: CreatePostDto,
  ): Promise<PostItem> {
    const owner = await this.prisma.user.findUnique({
      where: { username: normalizeUsername(username) },
      select: { id: true, username: true },
    });
    if (!owner) throw new NotFoundException('User not found');
    await requireWallAccess(this.prisma, authorId, owner.id);

    const { html, empty } = sanitizeRichText(content);
    if (empty) throw new BadRequestException('Post cannot be empty');

    const post = await this.prisma.post.create({
      data: { wallUserId: owner.id, authorId, content: html },
      include: postInclude,
    });
    await this.notifications.notify([
      {
        userId: owner.id,
        actorId: authorId,
        type: 'wall_post',
        message: 'posted on your wall',
        link: `/users/${owner.username}`,
      },
    ]);
    return { ...post, type: 'post' };
  }

  async create(
    communityId: number,
    authorId: number,
    { content }: CreatePostDto,
  ): Promise<PostItem> {
    const { html, empty } = sanitizeRichText(content);
    if (empty) throw new BadRequestException('Post cannot be empty');

    const post = await this.prisma.post.create({
      data: { communityId, authorId, content: html },
      include: postInclude,
    });
    return { ...post, type: 'post' };
  }
}
