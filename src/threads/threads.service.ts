import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '../../prisma/generated/client';
import { author, communitySummary } from '../common/author';
import { PAGE_SIZE, Page } from '../common/pagination';
import { sanitizeRichText } from '../common/rich-text';
import { reportedBy, visibleTo } from '../moderation/visibility';
import { requireMembership } from '../communities/require-membership';
import { MAX_INT } from '../communities/community-member.guard';
import { VotesService } from '../votes/votes.service';
import { CreateThreadDto } from './dto/create-thread.dto';

export const threadInclude = { author, community: communitySummary } as const;

export const THREAD_SORTS = ['hot', 'new', 'top'] as const;

export type ThreadSort = (typeof THREAD_SORTS)[number];

const MAX_OFFSET = 10000;

type ThreadRow = Prisma.ThreadGetPayload<{ include: typeof threadInclude }>;

export type ThreadSummary = ThreadRow & { type: 'thread'; myVote: number };

@Injectable()
export class ThreadsService {
  constructor(
    private prisma: PrismaService,
    private votes: VotesService,
  ) {}

  async withMyVotes(
    userId: number,
    threads: ThreadRow[],
  ): Promise<ThreadSummary[]> {
    const mine = await this.votes.myVotes(
      userId,
      'thread',
      threads.map(({ id }) => id),
    );
    return threads.map((thread) => ({
      ...thread,
      type: 'thread',
      myVote: mine.get(thread.id) ?? 0,
    }));
  }

  async list(
    userId: number,
    communityId: number,
    sort: string = 'hot',
    offset = 0,
  ): Promise<Page<ThreadSummary>> {
    if (!THREAD_SORTS.includes(sort as ThreadSort)) {
      throw new BadRequestException('sort must be hot, new or top');
    }
    if (offset < 0 || offset > MAX_OFFSET) {
      throw new BadRequestException('Invalid cursor');
    }

    const reported = (await reportedBy(this.prisma, userId)).thread;
    let threads: ThreadRow[];
    if (sort === 'hot') {
      const rows = await this.prisma.$queryRaw<{ id: number }[]>`
        SELECT "id" FROM "Thread"
        WHERE "communityId" = ${communityId}
          AND ("hiddenAt" IS NULL OR "authorId" = ${userId})
          AND NOT ("id" = ANY(${reported}::int[]))
        ORDER BY ("score" + 1) / power(extract(epoch from (now() - "createdAt")) / 3600 + 2, 1.5) DESC, "id" DESC
        OFFSET ${offset} LIMIT ${PAGE_SIZE + 1}`;
      const found = await this.prisma.thread.findMany({
        where: { id: { in: rows.map(({ id }) => id) } },
        include: threadInclude,
      });
      const byId = new Map(found.map((thread) => [thread.id, thread]));
      threads = rows.flatMap(({ id }) => byId.get(id) ?? []);
    } else {
      threads = await this.prisma.thread.findMany({
        where: { communityId, ...visibleTo(userId, reported) },
        orderBy:
          sort === 'top'
            ? [{ score: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }]
            : [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: offset,
        take: PAGE_SIZE + 1,
        include: threadInclude,
      });
    }

    return {
      items: await this.withMyVotes(userId, threads.slice(0, PAGE_SIZE)),
      nextCursor:
        threads.length > PAGE_SIZE ? String(offset + PAGE_SIZE) : null,
    };
  }

  async create(
    userId: number,
    communityId: number,
    { title, content = '', linkUrl }: CreateThreadDto,
  ): Promise<ThreadSummary> {
    const { html, empty } = sanitizeRichText(content);
    const thread = await this.prisma.$transaction(async (tx) => {
      const created = await tx.thread.create({
        data: {
          communityId,
          authorId: userId,
          title: title.trim(),
          content: empty ? '' : html,
          linkUrl: linkUrl ?? null,
          score: 1,
        },
        include: threadInclude,
      });
      await tx.vote.create({
        data: {
          userId,
          votableType: 'thread',
          votableId: created.id,
          communityId,
          value: 1,
        },
      });
      return created;
    });

    return { ...thread, type: 'thread', myVote: 1 };
  }

  async findOne(userId: number, id: number): Promise<ThreadSummary> {
    if (id < 1 || id > MAX_INT) throw new NotFoundException('Thread not found');

    const thread = await this.prisma.thread.findUnique({
      where: { id },
      include: threadInclude,
    });

    if (!thread || (thread.hiddenAt && thread.authorId !== userId)) {
      throw new NotFoundException('Thread not found');
    }
    await requireMembership(this.prisma, userId, thread.communityId);

    const [summary] = await this.withMyVotes(userId, [thread]);
    return summary;
  }
}
