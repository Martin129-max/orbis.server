import { BadRequestException, Injectable } from '@nestjs/common';
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

@Injectable()
export class PostsService {
  constructor(private prisma: PrismaService) {}

  findForCommunity(communityId: number) {
    return this.prisma.post.findMany({
      where: { communityId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { author },
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
