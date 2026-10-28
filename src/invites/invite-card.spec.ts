import { PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';
import sharp = require('sharp');
import { buildInviteCard } from './invite-card';

const input = {
  name: 'Anime Club',
  iconUrl: '/images/communities/anime-club.webp',
  coverUrl: 'https://media.example.com/covers/cover.webp',
  backgroundUrl: 'https://media.example.com/backgrounds/background.webp',
  qrUrl: 'https://orbis.example.com/qr/code',
};

async function imageCount(bytes: Uint8Array) {
  const pdf = await PDFDocument.load(bytes);
  return pdf.context
    .enumerateIndirectObjects()
    .filter(
      ([, object]) =>
        object instanceof PDFRawStream &&
        object.dict.get(PDFName.of('Subtype')) === PDFName.of('Image'),
    ).length;
}

describe('invite card PDF', () => {
  const originalFetch = global.fetch;
  const originalWebUrl = process.env.WEB_URL;
  const fetchMock = jest.fn();

  beforeAll(async () => {
    const png = await sharp({
      create: { width: 40, height: 20, channels: 3, background: '#336699' },
    })
      .png()
      .toBuffer();
    fetchMock.mockImplementation(async () => new Response(png));
  });

  beforeEach(() => {
    fetchMock.mockClear();
    global.fetch = fetchMock;
    process.env.WEB_URL = 'https://orbis.example.com';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.WEB_URL = originalWebUrl;
  });

  it('builds a two-page card with the community pictures', async () => {
    const bytes = await buildInviteCard(input);

    expect(Buffer.from(bytes.subarray(0, 5)).toString()).toBe('%PDF-');
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(2);
    expect(await imageCount(bytes)).toBeGreaterThanOrEqual(3);
    expect(fetchMock.mock.calls.map(([url]) => String(url)).sort()).toEqual([
      'https://media.example.com/backgrounds/background.webp',
      'https://media.example.com/covers/cover.webp',
      'https://orbis.example.com/images/communities/anime-club.webp',
    ]);
  });

  it('still builds the card when the pictures can’t be loaded', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    fetchMock.mockResolvedValueOnce(new Response('nope', { status: 404 }));
    fetchMock.mockResolvedValueOnce(new Response('not an image'));

    const bytes = await buildInviteCard(input);

    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(2);
    expect(await imageCount(bytes)).toBe(0);
  });

  it('skips pictures the community doesn’t have', async () => {
    const bytes = await buildInviteCard({
      ...input,
      iconUrl: null,
      coverUrl: null,
      backgroundUrl: null,
    });

    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(2);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
