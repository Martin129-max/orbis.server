import { ThreadsService } from './threads.service';
import { PrismaService } from '../prisma.service';
import { VotesService } from '../votes/votes.service';

jest.mock('../common/rich-text', () => ({ sanitizeRichText: jest.fn() }));

describe('ThreadsService.create', () => {
  const create = jest.fn(({ data }) => ({ id: 4, ...data, commentCount: 0 }));
  const service = new ThreadsService(
    { thread: { create } } as unknown as PrismaService,
    {} as VotesService,
  );
  const sanitize = jest.requireMock('../common/rich-text')
    .sanitizeRichText as jest.Mock;

  beforeEach(() => jest.clearAllMocks());

  it('saves the link card with the thread', async () => {
    sanitize.mockReturnValue({ html: '<p>Thoughts?</p>', empty: false });

    await service.create(1, 3, {
      title: '  Best arc?  ',
      content: '<p>Thoughts?</p>',
      linkUrl: 'https://youtu.be/dQw4w9WgXcQ',
    });

    expect(create.mock.calls[0][0].data).toMatchObject({
      title: 'Best arc?',
      content: '<p>Thoughts?</p>',
      linkUrl: 'https://youtu.be/dQw4w9WgXcQ',
    });
  });

  it('allows a thread that is only a title and a link', async () => {
    sanitize.mockReturnValue({ html: '', empty: true });

    await service.create(1, 3, {
      title: 'Watch this',
      linkUrl: 'https://example.com',
    });

    expect(create.mock.calls[0][0].data).toMatchObject({
      content: '',
      linkUrl: 'https://example.com',
    });
  });

  it('stores no link when none is given', async () => {
    sanitize.mockReturnValue({ html: '', empty: true });

    await service.create(1, 3, { title: 'Just a question' });

    expect(create.mock.calls[0][0].data.linkUrl).toBeNull();
  });
});
