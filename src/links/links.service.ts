import { Injectable } from '@nestjs/common';
import { parseMetadata, type LinkMetadata } from './link-metadata';
import { fetchHtml } from './safe-fetch';

const CACHE_SIZE = 1000;
const YOUTUBE_HOSTS = /^(www\.|m\.|music\.)?(youtube\.com|youtu\.be)$/;
const FOUND_TTL_MS = 12 * 60 * 60 * 1000;
const MISSING_TTL_MS = 30 * 60 * 1000;

type Cached = { expires: number; value: Promise<LinkMetadata | null> };

async function pagePreview(url: string) {
  const { url: page, html } = await fetchHtml(url);
  return parseMetadata(html, page);
}

async function youtubePreview(url: string): Promise<LinkMetadata | null> {
  const oembed = new URL('https://www.youtube.com/oembed');
  oembed.searchParams.set('url', url);
  oembed.searchParams.set('format', 'json');
  const { html } = await fetchHtml(oembed.toString(), undefined, /json/i);
  const video = JSON.parse(html) as {
    title?: unknown;
    author_name?: unknown;
    thumbnail_url?: unknown;
  };
  if (typeof video.title !== 'string' || !video.title) return null;

  return {
    url,
    title: video.title.slice(0, 200),
    description:
      typeof video.author_name === 'string' ? video.author_name : null,
    image:
      typeof video.thumbnail_url === 'string' &&
      video.thumbnail_url.startsWith('https://')
        ? video.thumbnail_url
        : null,
    siteName: 'YouTube',
  };
}

@Injectable()
export class LinksService {
  private readonly cache = new Map<string, Cached>();

  preview(target: string): Promise<LinkMetadata | null> {
    const url = new URL(target);
    url.hash = '';
    const key = url.toString();

    const cached = this.cache.get(key);
    if (cached && cached.expires > Date.now()) return cached.value;

    const value = (
      YOUTUBE_HOSTS.test(url.hostname) ? youtubePreview(key) : pagePreview(key)
    ).catch(() => null);
    this.remember(key, value, FOUND_TTL_MS);
    void value.then((found) => {
      if (!found) this.remember(key, value, MISSING_TTL_MS);
    });
    return value;
  }

  private remember(key: string, value: Cached['value'], ttl: number) {
    this.cache.delete(key);
    this.cache.set(key, { expires: Date.now() + ttl, value });
    if (this.cache.size > CACHE_SIZE) {
      this.cache.delete(this.cache.keys().next().value!);
    }
  }
}
