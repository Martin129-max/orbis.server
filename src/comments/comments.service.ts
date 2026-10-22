import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CommentableType, Prisma } from '../../prisma/generated/client';
import { author } from '../common/author';
import { sanitizeRichText } from '../common/rich-text';
import { requireMembership } from '../communities/require-membership';
import { requirePostAccess } from '../posts/wall-access';
import { MAX_INT } from '../communities/community-member.guard';
import { VotesService } from '../votes/votes.service';
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
  score: true,
  createdAt: true,
  author,
} as const;

export type CommentView = Prisma.CommentGetPayload<{
  select: typeof commentSelect;
}> & { myVote: number };

@Injectable()
export class CommentsService {
  constructor(
    private prisma: PrismaService,
    private votes: VotesService,
    private notifications: NotificationsService,
  ) {}

  private async homeOf(
    type: CommentableType,
    id: number,
  ): Promise<{ communityId: number | null; wallUserId: number | null }> {
    if (id < 1 || id > MAX_INT) throw new NotFoundException('Not found');

    const target =
      type === 'post'
        ? await this.prisma.post.findUnique({
            where: { id },
            select: { communityId: true, wallUserId: true },
          })
        : await this.prisma.thread
            .findUnique({ where: { id }, select: { communityId: true } })
            .then((thread) => thread && { ...thread, wallUserId: null });

    if (!target) throw new NotFoundException('Not found');
    return target;
  }

  async list(userId: number, type: string, id: number): Promise<CommentView[]> {
    if (!Object.values(CommentableType).includes(type as CommentableType)) {
      throw new BadRequestException('type must be post or thread');
    }

    const commentableType = type as CommentableType;
    const { communityId } = await this.homeOf(commentableType, id);
    if (communityId !== null) {
      await requireMembership(this.prisma, userId, communityId);
    }

    const comments = await this.prisma.comment.findMany({
      where: { commentableType, commentableId: id },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: MAX_COMMENTS,
      select: commentSelect,
    });
    const mine = await this.votes.myVotes(
      userId,
      'comment',
      comments.map((comment) => comment.id),
    );

    return comments.map((comment) => ({
      ...comment,
      myVote: mine.get(comment.id) ?? 0,
    }));
  }

  async create(
    userId: number,
    { type, id, parentId, content }: CreateCommentDto,
  ): Promise<CommentView> {
    const home = await this.homeOf(type, id);
    await requirePostAccess(this.prisma, userId, home);

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
    if (empty) throw new BadRequestException('Comment cannot be empty');

    const increment = { commentCount: { increment: 1 } };
    const [comment] = await this.prisma.$transaction([
      this.prisma.comment.create({
        data: {
          communityId: home.communityId,
          commentableType: type,
          commentableId: id,
          parentId,
          authorId: userId,
          content: html,
        },
        select: commentSelect,
      }),
      type === 'post'
        ? this.prisma.post.update({ where: { id }, data: increment })
        : this.prisma.thread.update({ where: { id }, data: increment }),
    ]);

    await this.notifyCommented(userId, type, id, home, parentAuthorId);
    return { ...comment, myVote: 0 };
  }

  private async notifyCommented(
    userId: number,
    type: CommentableType,
    id: number,
    home: { communityId: number | null; wallUserId: number | null },
    parentAuthorId?: number,
  ) {
    const target =
      type === 'post'
        ? await this.prisma.post.findUnique({
            where: { id },
            select: { authorId: true },
          })
        : await this.prisma.thread.findUnique({
            where: { id },
            select: { authorId: true, title: true },
          });
    const wall =
      home.wallUserId !== null &&
      (await this.prisma.user.findUnique({
        where: { id: home.wallUserId },
        select: { username: true },
      }));
    const link = wall
      ? `/users/${wall.username}`
      : `/communities/${home.communityId}${type === 'thread' ? '?tab=forum' : ''}`;
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
    if (target && target.authorId !== parentAuthorId) {
      notifications.push({
        userId: target.authorId,
        actorId: userId,
        type: type === 'post' ? 'post_comment' : 'thread_comment',
        message:
          'title' in target
            ? `commented on your thread “${target.title}”`
            : 'commented on your post',
        link,
      });
    }

    await this.notifications.notify(notifications);
  }
}
