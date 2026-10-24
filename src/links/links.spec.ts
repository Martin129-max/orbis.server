import { parseMetadata } from './link-metadata';
import { fetchHtml, isPublicAddress } from './safe-fetch';

describe('parseMetadata', () => {
  it('reads Open Graph tags and resolves relative images', () => {
    const html = `<html><head>
      <meta property="og:title" content="Tom &amp; Jerry &#8212; Remastered">
      <meta content='A classic, cleaned up.' property='og:description'>
      <meta property="og:image" content="/covers/tom.jpg">
      <meta property="og:site_name" content="Cartoon Vault">
      <title>Ignored</title></head></html>`;

    expect(parseMetadata(html, 'https://example.com/shows/tom')).toEqual({
      url: 'https://example.com/shows/tom',
      title: 'Tom & Jerry — Remastered',
      description: 'A classic, cleaned up.',
      image: 'https://example.com/covers/tom.jpg',
      siteName: 'Cartoon Vault',
    });
  });

  it('falls back to the title tag, description and host name', () => {
    const html = `<title>  Plain   page </title><meta name="description" content="Hello">`;

    expect(parseMetadata(html, 'https://www.example.org/a')).toEqual({
      url: 'https://www.example.org/a',
      title: 'Plain page',
      description: 'Hello',
      image: null,
      siteName: 'example.org',
    });
  });

  it('ignores non-web image URLs and pages without a title', () => {
    expect(
      parseMetadata(
        '<meta property="og:title" content="X"><meta property="og:image" content="javascript:alert(1)">',
        'https://example.com',
      )?.image,
    ).toBeNull();
    expect(parseMetadata('<p>no head</p>', 'https://example.com')).toBeNull();
  });
});

describe('isPublicAddress', () => {
  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '172.20.0.1',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '::1',
    'fd00::1',
    'fe80::1',
    '::ffff:127.0.0.1',
    'not-an-ip',
  ])('blocks %s', (address) => {
    expect(isPublicAddress(address)).toBe(false);
  });

  it.each(['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111'])(
    'allows %s',
    (address) => {
      expect(isPublicAddress(address)).toBe(true);
    },
  );
});

describe('fetchHtml', () => {
  it.each([
    'http://127.0.0.1/',
    'http://[::1]/',
    'http://169.254.169.254/latest/meta-data',
    'http://localhost/',
    'http://example.com:8080/',
    'ftp://example.com/',
    'http://user:pass@example.com/',
  ])('refuses %s', async (url) => {
    await expect(fetchHtml(url)).rejects.toThrow();
  });
});
