import { BadRequestException } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { PrismaService } from '../prisma.service';
import { VotesService } from '../votes/votes.service';
import { NotificationsService } from '../notifications/notifications.service';

jest.mock('../posts/wall-access', () => ({
  targetOf: jest.fn(async () => ({
    type: 'post',
    id: 7,
    communityId: 3,
    ownerId: 2,
    wallUserId: null,
  })),
  requireTargetAccess: jest.fn(async () => undefined),
}));
jest.mock('../common/rich-text', () => ({ sanitizeRichText: jest.fn() }));

describe('CommentsService.create', () => {
  const comment = jest.fn(({ data }) => ({
    id: 11,
    ...data,
    createdAt: new Date(),
    author: { id: 1, username: 'reader', name: null, avatarUrl: null },
  }));
  const voteCreate = jest.fn();
  const prisma = {
    comment: {
      create: comment,
      findUnique: jest.fn(),
    },
    vote: { create: voteCreate },
    post: { update: jest.fn() },
    thread: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
    $transaction: jest.fn((run) => run(prisma)),
  };
  const notifications = { notify: jest.fn() };
  const service = new CommentsService(
    prisma as unknown as PrismaService,
    {} as VotesService,
    notifications as unknown as NotificationsService,
  );
  const sanitize = jest.requireMock('../common/rich-text')
    .sanitizeRichText as jest.Mock;

  beforeEach(() => jest.clearAllMocks());

  it('starts the comment at 1 with the author’s own upvote', async () => {
    sanitize.mockReturnValue({ html: '<p>Nice</p>', empty: false });

    const created = await service.create(1, {
      type: 'post',
      id: 7,
      content: '<p>Nice</p>',
    });

    expect(comment.mock.calls[0][0].data.score).toBe(1);
    expect(voteCreate).toHaveBeenCalledWith({
      data: {
        userId: 1,
        votableType: 'comment',
        votableId: 11,
        communityId: 3,
        value: 1,
      },
    });
    expect(prisma.post.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { commentCount: { increment: 1 } },
    });
    expect(created).toMatchObject({ score: 1, myVote: 1 });
  });

  it('saves the link with the comment', async () => {
    sanitize.mockReturnValue({ html: '<p>Look</p>', empty: false });

    await service.create(1, {
      type: 'post',
      id: 7,
      content: '<p>Look</p>',
      linkUrl: 'https://youtu.be/dQw4w9WgXcQ',
    });

    expect(comment.mock.calls[0][0].data).toMatchObject({
      content: '<p>Look</p>',
      linkUrl: 'https://youtu.be/dQw4w9WgXcQ',
    });
  });

  it('allows a comment that is only a link card', async () => {
    sanitize.mockReturnValue({ html: '<p></p>', empty: true });

    await service.create(1, {
      type: 'post',
      id: 7,
      content: '<p></p>',
      linkUrl: 'https://example.com',
    });

    expect(comment.mock.calls[0][0].data).toMatchObject({
      content: '',
      linkUrl: 'https://example.com',
    });
  });

  it('still rejects empty comments without a link', async () => {
    sanitize.mockReturnValue({ html: '<p></p>', empty: true });

    await expect(
      service.create(1, { type: 'post', id: 7, content: '<p></p>' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(comment).not.toHaveBeenCalled();
  });
});
