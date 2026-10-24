export type LinkMetadata = {
  url: string;
  title: string;
  description: string | null;
  image: string | null;
  siteName: string;
};

const entities: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function decode(text: string) {
  return text.replace(
    /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
    (match, code: string) => {
      if (code[0] === '#') {
        const value =
          code[1] === 'x' || code[1] === 'X'
            ? parseInt(code.slice(2), 16)
            : parseInt(code.slice(1), 10);
        return value > 0 && value <= 0x10ffff
          ? String.fromCodePoint(value)
          : match;
      }
      return entities[code.toLowerCase()] ?? match;
    },
  );
}

function clip(text: string, max: number) {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

function attributes(tag: string) {
  const found: Record<string, string> = {};
  for (const [, name, double, single, bare] of tag.matchAll(
    /([^\s=<>"'/]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g,
  )) {
    found[name.toLowerCase()] = double ?? single ?? bare;
  }
  return found;
}

function absoluteUrl(value: string | undefined, base: string) {
  if (!value) return null;
  try {
    const url = new URL(value, base);
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export function parseMetadata(
  html: string,
  pageUrl: string,
): LinkMetadata | null {
  const meta = new Map<string, string>();
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const { property, name, content } = attributes(tag);
    const key = (property ?? name ?? '').toLowerCase();
    const value = content === undefined ? '' : decode(content).trim();
    if (key && value && !meta.has(key)) meta.set(key, value);
  }

  const titleTag = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const title =
    meta.get('og:title') ??
    meta.get('twitter:title') ??
    (titleTag ? decode(titleTag).trim() : '');
  if (!title) return null;

  const description =
    meta.get('og:description') ??
    meta.get('twitter:description') ??
    meta.get('description');
  const image =
    meta.get('og:image:secure_url') ??
    meta.get('og:image') ??
    meta.get('og:image:url') ??
    meta.get('twitter:image') ??
    meta.get('twitter:image:src');
  const siteName =
    meta.get('og:site_name') ?? new URL(pageUrl).hostname.replace(/^www\./, '');

  return {
    url: pageUrl,
    title: clip(title, 200),
    description: description ? clip(description, 300) : null,
    image: absoluteUrl(image, pageUrl),
    siteName: clip(siteName, 80),
  };
}
