import { BadRequestException, Injectable } from '@nestjs/common';
import { MAX_INT } from '../communities/community-member.guard';
import * as sanitizeHtml from 'sanitize-html';
import { PrismaService } from '../prisma.service';
import { CreatePostDto } from './dto/create-post.dto';

const sanitizeOptions: sanitizeHtml.IOptions = {
  allowedTags: [
    'p',
    'br',
    'strong',
    'em',
    's',
    'u',
    'code',
    'pre',
    'blockquote',
    'ul',
    'ol',
    'li',
    'a',
  ],
  allowedAttributes: { a: ['href', 'target', 'rel'] },
  allowedSchemes: ['http', 'https', 'mailto'],
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', {
      target: '_blank',
      rel: 'noopener noreferrer nofollow',
    }),
  },
};

const author = { select: { id: true, email: true, name: true } } as const;

const PAGE_SIZE = 10;

function page(cursor?: number) {
  if (cursor !== undefined && (cursor < 1 || cursor > MAX_INT)) {
    throw new BadRequestException('Invalid cursor');
  }

  return {
    orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }],
    take: PAGE_SIZE,
    ...(cursor !== undefined && { cursor: { id: cursor }, skip: 1 }),
  };
}

@Injectable()
export class PostsService {
  constructor(private prisma: PrismaService) {}

  findForCommunity(communityId: number, cursor?: number) {
    return this.prisma.post.findMany({
      where: { communityId },
      ...page(cursor),
      include: { author },
    });
  }

  findForMember(userId: number, cursor?: number) {
    return this.prisma.post.findMany({
      where: { community: { memberships: { some: { userId } } } },
      ...page(cursor),
      include: { author, community: { select: { id: true, name: true } } },
    });
  }

  create(communityId: number, authorId: number, { content }: CreatePostDto) {
    const html = sanitizeHtml(content, sanitizeOptions).replace(
      /(<p>\s*(<br\s*\/?>)?\s*<\/p>\s*)+$/,
      '',
    );
    const text = sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} });

    if (!text.trim()) {
      throw new BadRequestException('Post cannot be empty');
    }

    return this.prisma.post.create({
      data: { communityId, authorId, content: html },
      include: { author },
    });
  }
}
