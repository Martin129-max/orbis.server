import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { getMedia, searchMedia } from './library-api';

describe('Library API', () => {
  const fetchMock = jest.fn();

  beforeAll(() => {
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  beforeEach(() => jest.clearAllMocks());

  function respond(status: number, body: unknown = {}) {
    fetchMock.mockResolvedValueOnce({
      status,
      ok: status >= 200 && status < 300,
      json: async () => body,
    });
  }

  it('only asks for 18+ titles when NSFW is on', async () => {
    respond(200, { results: { anime: [], manga: [], game: [] } });
    respond(200, { results: { anime: [], manga: [], game: [] } });

    await searchMedia('frieren', false);
    await searchMedia('frieren', true);

    expect(fetchMock.mock.calls[0][0]).not.toContain('adult=');
    expect(fetchMock.mock.calls[1][0]).toContain('adult=true');
  });

  it('explains when a title is 18+', async () => {
    respond(403, { error: 'Adult content' });

    await expect(getMedia('anime', '1', false)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('still reports a missing title as not found', async () => {
    respond(404, { error: 'Not found' });

    await expect(getMedia('anime', '1', false)).rejects.toThrow(
      NotFoundException,
    );
  });
});
