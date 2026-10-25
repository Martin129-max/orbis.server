import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { normalizeUsername } from '../users/username';
import { MAX_INT } from '../communities/community-member.guard';
import { PrismaService } from '../prisma.service';
import {
  LibraryStatus,
  MediaType,
  Prisma,
} from '../../prisma/generated/client';
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
import {
  canViewProfile,
  friendsOf,
  requireWallAccess,
} from './wall-access';
import { LikesService } from '../likes/likes.service';
import { getMedia } from '../library/library-api';
import { reportedBy, visibleTo } from '../moderation/visibility';

const postInclude = {
  author,
  community: communitySummary,
  wallUser: author,
} as const;

const previewSelect = {
  id: true,
  content: true,
  linkUrl: true,
  createdAt: true,
  author,
} as const;

const PREVIEW_COMMENTS = 3;

function postBody({ content, linkUrl }: CreatePostDto) {
  const { html, empty } = sanitizeRichText(content);
  if (empty && !linkUrl) throw new BadRequestException('Post cannot be empty');
  return { content: empty ? '' : html, linkUrl: linkUrl ?? null };
}

export type PreviewComment = Prisma.CommentGetPayload<{
  select: typeof previewSelect;
}>;

type Engagement = { previewComments: PreviewComment[] };

type RawPost = Prisma.PostGetPayload<{
  include: typeof postInclude;
}> & { type: 'post' };

export type PostItem = RawPost & Engagement & { liked: boolean };

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

type RawActivity = {
  type: 'activity';
  id: number;
  createdAt: Date;
  commentCount: number;
  likeCount: number;
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

export type ActivityItem = RawActivity & Engagement & { liked: boolean };

export type FeedItem = PostItem | (ThreadSummary & Engagement) | ActivityItem;

const RANK = { post: 0, thread: 1, activity: 2 } as const;

function excludedTypes(raw?: string) {
  if (!raw) return new Set<string>();
  const types = raw.split(',');
  if (types.some((type) => !Object.prototype.hasOwnProperty.call(RANK, type))) {
    throw new BadRequestException('Invalid feed content type');
  }
  return new Set(types);
}

type FeedCursor = { createdAt: Date; rank: number; id: number };

const newestFirst = [{ createdAt: 'desc' as const }, { id: 'desc' as const }];

const SEARCH_LIMIT = 8;

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
): RawActivity {
  const { entry } = activity;
  return {
    type: 'activity',
    id: activity.id,
    createdAt: activity.createdAt,
    commentCount: activity.commentCount,
    likeCount: activity.likeCount,
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
    private likes: LikesService,
  ) {}

  private async engage(
    viewerId: number,
    items: (RawPost | ThreadSummary | RawActivity)[],
  ): Promise<FeedItem[]> {
    const idsOf = (type: 'post' | 'activity') =>
      items.flatMap((item) => (item.type === type ? [item.id] : []));
    const reported = await reportedBy(this.prisma, viewerId);
    const [likedPosts, likedActivities, previews] = await Promise.all([
      this.likes.likedBy(viewerId, 'post', idsOf('post')),
      this.likes.likedBy(viewerId, 'activity', idsOf('activity')),
      Promise.all(
        items.map((item) =>
          item.commentCount === 0
            ? []
            : this.prisma.comment
                .findMany({
                  where: {
                    commentableType: item.type,
                    commentableId: item.id,
                    parentId: null,
                    ...visibleTo(viewerId, reported.comment),
                  },
                  orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
                  take: PREVIEW_COMMENTS,
                  select: previewSelect,
                })
                .then((comments) => comments.reverse()),
        ),
      ),
    ]);

    return items.map((item, index) => {
      const previewComments = previews[index];
      if (item.type === 'thread') return { ...item, previewComments };
      const liked = (item.type === 'post' ? likedPosts : likedActivities).has(
        item.id,
      );
      return { ...item, liked, previewComments };
    });
  }

  async findForCommunity(
    viewerId: number,
    communityId: number,
    rawCursor?: string,
    exclude?: string,
  ): Promise<Page<FeedItem>> {
    const cursor = parseFeedCursor(rawCursor);
    const excluded = excludedTypes(exclude);
    const reported = await reportedBy(this.prisma, viewerId);

    const [posts, activities] = await Promise.all([
      excluded.has('post')
        ? []
        : this.prisma.post.findMany({
            where: {
              communityId,
              ...olderThan(cursor, RANK.post),
              ...visibleTo(viewerId, reported.post),
            },
            orderBy: newestFirst,
            take: PAGE_SIZE + 1,
            include: postInclude,
          }),
      excluded.has('activity')
        ? []
        : this.prisma.libraryActivity.findMany({
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
    const page = merged.slice(0, PAGE_SIZE);

    return {
      items: await this.engage(viewerId, page),
      nextCursor: nextCursor(merged, page),
    };
  }

  async searchCommunity(
    viewerId: number,
    communityId: number,
    rawQuery: string,
  ): Promise<FeedItem[]> {
    const query = rawQuery.trim().slice(0, 100);
    if (query.length < 2) return [];

    const reported = await reportedBy(this.prisma, viewerId);
    const contains = { contains: query, mode: 'insensitive' as const };
    const [threads, posts] = await Promise.all([
      this.prisma.thread.findMany({
        where: {
          communityId,
          OR: [{ title: contains }, { content: contains }],
          ...visibleTo(viewerId, reported.thread),
        },
        orderBy: newestFirst,
        take: SEARCH_LIMIT,
        include: threadInclude,
      }),
      this.prisma.post.findMany({
        where: {
          communityId,
          content: contains,
          ...visibleTo(viewerId, reported.post),
        },
        orderBy: newestFirst,
        take: SEARCH_LIMIT,
        include: postInclude,
      }),
    ]);

    const voted = await this.threads.withMyVotes(
      viewerId,
      threads.map((thread) => ({ ...thread, type: 'thread' as const })),
    );
    return this.engage(viewerId, [
      ...voted,
      ...posts.map((post) => ({ ...post, type: 'post' as const })),
    ]);
  }

  async findForMember(
    userId: number,
    rawCursor?: string,
    exclude?: string,
  ): Promise<Page<FeedItem>> {
    const cursor = parseFeedCursor(rawCursor);
    const excluded = excludedTypes(exclude);
    const member = { community: { memberships: { some: { userId } } } };
    const reported = await reportedBy(this.prisma, userId);

    const [posts, threads, activities] = await Promise.all([
      excluded.has('post')
        ? []
        : this.prisma.post.findMany({
            where: {
              AND: [
                {
                  OR: [
                    member,
                    { wallUserId: userId },
                    { authorId: userId, communityId: null, mediaType: null },
                    { wallUser: friendsOf(userId) },
                  ],
                },
                olderThan(cursor, RANK.post),
                visibleTo(userId, reported.post),
              ],
            },
            orderBy: newestFirst,
            take: PAGE_SIZE + 1,
            include: postInclude,
          }),
      excluded.has('thread')
        ? []
        : this.prisma.thread.findMany({
            where: {
              ...member,
              ...olderThan(cursor, RANK.thread),
              ...visibleTo(userId, reported.thread),
            },
            orderBy: newestFirst,
            take: PAGE_SIZE + 1,
            include: threadInclude,
          }),
      excluded.has('activity')
        ? []
        : this.prisma.libraryActivity.findMany({
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
    const items = await this.engage(
      userId,
      page.map((item) => (item.type === 'thread' ? voted.get(item.id)! : item)),
    );

    return { items, nextCursor: nextCursor(merged, page) };
  }

  async findForProfile(
    viewerId: number,
    username: string,
    rawCursor?: string,
    exclude?: string,
  ): Promise<Page<FeedItem>> {
    const cursor = parseFeedCursor(rawCursor);
    const excluded = excludedTypes(exclude);
    const owner = await this.prisma.user.findUnique({
      where: { username: normalizeUsername(username) },
      select: { id: true, isPublic: true },
    });
    if (!owner) throw new NotFoundException('User not found');
    if (!(await canViewProfile(this.prisma, viewerId, owner))) {
      throw new ForbiddenException('This profile is private');
    }

    const reported = await reportedBy(this.prisma, viewerId);
    const visibleCommunity = {
      OR: [{ isPublic: true }, { memberships: { some: { userId: viewerId } } }],
    };
    const [posts, threads, activities] = await Promise.all([
      excluded.has('post')
        ? []
        : this.prisma.post.findMany({
            where: {
              AND: [
                {
                  OR: [
                    { wallUserId: owner.id },
                    { authorId: owner.id, communityId: null, mediaType: null },
                    { authorId: owner.id, community: visibleCommunity },
                  ],
                },
                olderThan(cursor, RANK.post),
                visibleTo(viewerId, reported.post),
              ],
            },
            orderBy: newestFirst,
            take: PAGE_SIZE + 1,
            include: postInclude,
          }),
      excluded.has('thread')
        ? []
        : this.prisma.thread.findMany({
            where: {
              authorId: owner.id,
              community: visibleCommunity,
              ...olderThan(cursor, RANK.thread),
              ...visibleTo(viewerId, reported.thread),
            },
            orderBy: newestFirst,
            take: PAGE_SIZE + 1,
            include: threadInclude,
          }),
      excluded.has('activity')
        ? []
        : this.prisma.libraryActivity.findMany({
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
    const items = await this.engage(
      viewerId,
      page.map((item) => (item.type === 'thread' ? voted.get(item.id)! : item)),
    );

    return { items, nextCursor: nextCursor(merged, page) };
  }

  async createOnWall(
    username: string,
    authorId: number,
    body: CreatePostDto,
  ): Promise<PostItem> {
    const owner = await this.prisma.user.findUnique({
      where: { username: normalizeUsername(username) },
      select: { id: true, username: true },
    });
    if (!owner) throw new NotFoundException('User not found');
    await requireWallAccess(this.prisma, authorId, owner.id);

    const post = await this.prisma.post.create({
      data: { wallUserId: owner.id, authorId, ...postBody(body) },
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
    return { ...post, type: 'post', liked: false, previewComments: [] };
  }

  async findForMedia(
    viewerId: number,
    mediaType: MediaType,
    mediaSourceId: string,
    rawCursor?: string,
    exclude?: string,
  ): Promise<Page<FeedItem>> {
    const cursor = parseFeedCursor(rawCursor);
    const excluded = excludedTypes(exclude);
    const posts = excluded.has('post')
      ? []
      : await this.prisma.post.findMany({
          where: {
            mediaType,
            mediaSourceId,
            ...olderThan(cursor, RANK.post),
            ...visibleTo(
              viewerId,
              (await reportedBy(this.prisma, viewerId)).post,
            ),
          },
          orderBy: newestFirst,
          take: PAGE_SIZE + 1,
          include: postInclude,
        });

    const merged = posts.map((post) => ({ ...post, type: 'post' as const }));
    const page = merged.slice(0, PAGE_SIZE);
    const items = await this.engage(viewerId, page);
    return { items, nextCursor: nextCursor(merged, page) };
  }

  async createOnMedia(
    mediaType: MediaType,
    mediaSourceId: string,
    authorId: number,
    body: CreatePostDto,
  ): Promise<PostItem> {
    if (!/^\d{1,12}$/.test(mediaSourceId)) {
      throw new NotFoundException('Title not found');
    }
    await getMedia(mediaType, mediaSourceId);

    const post = await this.prisma.post.create({
      data: { mediaType, mediaSourceId, authorId, ...postBody(body) },
      include: postInclude,
    });
    return { ...post, type: 'post', liked: false, previewComments: [] };
  }

  async create(
    communityId: number,
    authorId: number,
    body: CreatePostDto,
  ): Promise<PostItem> {
    const post = await this.prisma.post.create({
      data: { communityId, authorId, ...postBody(body) },
      include: postInclude,
    });
    return { ...post, type: 'post', liked: false, previewComments: [] };
  }
}
