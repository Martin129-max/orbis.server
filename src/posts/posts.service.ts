import { BadRequestException, Injectable } from '@nestjs/common';
import { MAX_INT } from '../communities/community-member.guard';
import { PrismaService } from '../prisma.service';
import { Prisma } from '../../prisma/generated/client';
import { author, communitySummary } from '../common/author';
import { PAGE_SIZE, Page } from '../common/pagination';
import { sanitizeRichText } from '../common/rich-text';
import {
  ThreadSummary,
  ThreadsService,
  threadInclude,
} from '../threads/threads.service';
import { CreatePostDto } from './dto/create-post.dto';

const postInclude = { author, community: communitySummary } as const;

export type PostItem = Prisma.PostGetPayload<{
  include: typeof postInclude;
}> & { type: 'post' };

export type FeedItem = PostItem | ThreadSummary;

const RANK = { post: 0, thread: 1 } as const;

type FeedCursor = { createdAt: Date; rank: number; id: number };

const newestFirst = [{ createdAt: 'desc' as const }, { id: 'desc' as const }];

function parseFeedCursor(raw?: string): FeedCursor | undefined {
  if (raw === undefined) return undefined;

  const match = /^(\d{1,15})_([01])_(\d{1,10})$/.exec(raw);
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

@Injectable()
export class PostsService {
  constructor(
    private prisma: PrismaService,
    private threads: ThreadsService,
  ) {}

  async findForCommunity(
    communityId: number,
    cursor?: number,
  ): Promise<Page<PostItem>> {
    if (cursor !== undefined && (cursor < 1 || cursor > MAX_INT)) {
      throw new BadRequestException('Invalid cursor');
    }

    const posts = await this.prisma.post.findMany({
      where: { communityId },
      orderBy: newestFirst,
      take: PAGE_SIZE + 1,
      ...(cursor !== undefined && { cursor: { id: cursor }, skip: 1 }),
      include: postInclude,
    });
    const items = posts
      .slice(0, PAGE_SIZE)
      .map((post) => ({ ...post, type: 'post' as const }));

    return {
      items,
      nextCursor:
        posts.length > PAGE_SIZE ? String(items[items.length - 1].id) : null,
    };
  }

  async findForMember(
    userId: number,
    rawCursor?: string,
  ): Promise<Page<FeedItem>> {
    const cursor = parseFeedCursor(rawCursor);
    const member = { community: { memberships: { some: { userId } } } };

    const [posts, threads] = await Promise.all([
      this.prisma.post.findMany({
        where: { ...member, ...olderThan(cursor, RANK.post) },
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
    ]);

    const merged = [
      ...posts.map((post) => ({ ...post, type: 'post' as const })),
      ...threads.map((thread) => ({ ...thread, type: 'thread' as const })),
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
    const last = items[items.length - 1];

    return {
      items,
      nextCursor:
        merged.length > PAGE_SIZE
          ? `${last.createdAt.getTime()}_${RANK[last.type]}_${last.id}`
          : null,
    };
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
