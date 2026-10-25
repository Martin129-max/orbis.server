import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CommentableType, Prisma } from '../../prisma/generated/client';
import { author } from '../common/author';
import { sanitizeRichText } from '../common/rich-text';
import { requireViewAccess } from '../communities/require-membership';
import {
  EngagementTarget,
  requireProfileView,
  requireTargetAccess,
  targetOf,
} from '../posts/wall-access';
import { MAX_INT } from '../communities/community-member.guard';
import { VotesService } from '../votes/votes.service';
import { reportedBy } from '../moderation/visibility';
import { CreateCommentDto } from './dto/create-comment.dto';
import {
  NewNotification,
  NotificationsService,
} from '../notifications/notifications.service';

const MAX_COMMENTS = 1000;

const commentSelect = {
  id: true,
  parentId: true,
  content: true,
  linkUrl: true,
  score: true,
  hiddenAt: true,
  createdAt: true,
  author,
} as const;

export type CommentView = Prisma.CommentGetPayload<{
  select: typeof commentSelect;
}> & { myVote: number; hidden: 'review' | 'reported' | null };

@Injectable()
export class CommentsService {
  constructor(
    private prisma: PrismaService,
    private votes: VotesService,
    private notifications: NotificationsService,
  ) {}

  async list(userId: number, type: string, id: number): Promise<CommentView[]> {
    if (!Object.values(CommentableType).includes(type as CommentableType)) {
      throw new BadRequestException('type must be post, thread, or activity');
    }

    const commentableType = type as CommentableType;
    const { communityId, wallUserId } = await targetOf(
      this.prisma,
      userId,
      commentableType,
      id,
    );
    if (communityId !== null) {
      await requireViewAccess(this.prisma, userId, communityId);
    } else if (wallUserId !== null) {
      await requireProfileView(this.prisma, userId, wallUserId);
    }

    const comments = await this.prisma.comment.findMany({
      where: { commentableType, commentableId: id },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: MAX_COMMENTS,
      select: commentSelect,
    });
    const [mine, reported] = await Promise.all([
      this.votes.myVotes(
        userId,
        'comment',
        comments.map((comment) => comment.id),
      ),
      reportedBy(this.prisma, userId),
    ]);
    const reportedIds = new Set(reported.comment);

    return comments.map((comment) => {
      const own = comment.author.id === userId;
      const hidden = reportedIds.has(comment.id)
        ? ('reported' as const)
        : comment.hiddenAt && !own
          ? ('review' as const)
          : null;
      return {
        ...comment,
        content: hidden ? '' : comment.content,
        linkUrl: hidden ? null : comment.linkUrl,
        myVote: mine.get(comment.id) ?? 0,
        hidden,
      };
    });
  }

  async create(
    userId: number,
    { type, id, parentId, content, linkUrl }: CreateCommentDto,
  ): Promise<CommentView> {
    const home = await targetOf(this.prisma, userId, type, id);
    await requireTargetAccess(this.prisma, userId, home);

    let parentAuthorId: number | undefined;
    if (parentId !== undefined) {
      const parent = await this.prisma.comment.findUnique({
        where: { id: parentId },
        select: { commentableType: true, commentableId: true, authorId: true },
      });
      parentAuthorId = parent?.authorId;
      if (parent?.commentableType !== type || parent.commentableId !== id) {
        throw new BadRequestException('Invalid parent comment');
      }
    }

    const { html, empty } = sanitizeRichText(content);
    if (empty && !linkUrl) {
      throw new BadRequestException('Comment cannot be empty');
    }

    const increment = { commentCount: { increment: 1 } };
    const comment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.comment.create({
        data: {
          communityId: home.communityId,
          commentableType: type,
          commentableId: id,
          parentId,
          authorId: userId,
          content: empty ? '' : html,
          linkUrl: linkUrl ?? null,
          score: 1,
        },
        select: commentSelect,
      });
      await tx.vote.create({
        data: {
          userId,
          votableType: 'comment',
          votableId: created.id,
          communityId: home.communityId,
          value: 1,
        },
      });
      await (type === 'post'
        ? tx.post.update({ where: { id }, data: increment })
        : type === 'thread'
          ? tx.thread.update({ where: { id }, data: increment })
          : tx.libraryActivity.update({ where: { id }, data: increment }));
      return created;
    });

    await this.notifyCommented(userId, home, parentAuthorId);
    return { ...comment, myVote: 1, hidden: null };
  }

  private async notifyCommented(
    userId: number,
    target: EngagementTarget,
    parentAuthorId?: number,
  ) {
    const { type, id } = target;
    const thread =
      type === 'thread'
        ? await this.prisma.thread.findUnique({
            where: { id },
            select: { title: true },
          })
        : null;
    const profileOwner =
      target.wallUserId ?? (type === 'activity' ? target.ownerId : null);
    const profile =
      profileOwner !== null &&
      (await this.prisma.user.findUnique({
        where: { id: profileOwner },
        select: { username: true },
      }));
    const link = target.mediaType
      ? `/library/${target.mediaType}/${target.mediaSourceId}`
      : profile
        ? `/users/${profile.username}`
        : `/communities/${target.communityId}${type === 'thread' ? '?tab=forum' : ''}`;
    const notifications: NewNotification[] = [];

    if (parentAuthorId !== undefined) {
      notifications.push({
        userId: parentAuthorId,
        actorId: userId,
        type: 'comment_reply',
        message: 'replied to your comment',
        link,
      });
    }
    if (target.ownerId !== parentAuthorId) {
      notifications.push({
        userId: target.ownerId,
        actorId: userId,
        type: type === 'thread' ? 'thread_comment' : 'post_comment',
        message: thread
          ? `commented on your thread “${thread.title}”`
          : type === 'activity'
            ? 'commented on your library update'
            : 'commented on your post',
        link,
      });
    }

    await this.notifications.notify(notifications);
  }
}
