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
import { MAX_INT } from '../communities/community-member.guard';
import { VotesService } from '../votes/votes.service';
import { CreateCommentDto } from './dto/create-comment.dto';

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
  ) {}

  private async communityOf(type: CommentableType, id: number) {
    if (id < 1 || id > MAX_INT) throw new NotFoundException('Not found');

    const target =
      type === 'post'
        ? await this.prisma.post.findUnique({
            where: { id },
            select: { communityId: true },
          })
        : await this.prisma.thread.findUnique({
            where: { id },
            select: { communityId: true },
          });

    if (!target) throw new NotFoundException('Not found');
    return target.communityId;
  }

  async list(userId: number, type: string, id: number): Promise<CommentView[]> {
    if (!Object.values(CommentableType).includes(type as CommentableType)) {
      throw new BadRequestException('type must be post or thread');
    }

    const commentableType = type as CommentableType;
    const communityId = await this.communityOf(commentableType, id);
    await requireMembership(this.prisma, userId, communityId);

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
    const communityId = await this.communityOf(type, id);
    await requireMembership(this.prisma, userId, communityId);

    if (parentId !== undefined) {
      const parent = await this.prisma.comment.findUnique({
        where: { id: parentId },
        select: { commentableType: true, commentableId: true },
      });
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
          communityId,
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

    return { ...comment, myVote: 0 };
  }
}
