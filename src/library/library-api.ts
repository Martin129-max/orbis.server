import {
  BadGatewayException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { MediaType } from '../../prisma/generated/client';

export type Media = {
  id: string;
  type: 'ANIME' | 'MANGA' | 'GAME';
  sourceId: string;
  title: string;
  coverImage: string | null;
  year: number | null;
  score: number | null;
  isAdult?: boolean;
  synopsis?: string | null;
  bannerImage?: string | null;
  status?: string | null;
  genres?: string[];
  altTitles?: string[];
  source?: { provider: string; url: string };
  details?: Record<string, unknown>;
};

export const ADULT_CONTENT =
  'This title is 18+. Turn on Show NSFW content in Settings to see it';

const baseUrl = () =>
  (process.env.LIBRARY_API_URL ?? 'https://library.boseriko.com').replace(
    /\/$/,
    '',
  );

async function request<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${baseUrl()}${path}`, {
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new BadGatewayException('The library service is unavailable');
  }
  if (res.status === 404) throw new NotFoundException('Title not found');
  if (res.status === 403) throw new ForbiddenException(ADULT_CONTENT);
  if (!res.ok) {
    throw new BadGatewayException('The library service is unavailable');
  }
  return (await res.json()) as T;
}

export async function searchMedia(q: string, adult: boolean) {
  const query = new URLSearchParams({ q, limit: '6' });
  if (adult) query.set('adult', 'true');
  const { results } = await request<{
    results: Record<'anime' | 'manga' | 'game', Media[]>;
  }>(`/api/search?${query}`);
  return results;
}

export type SteamMatch = { sourceId: string; title: string };

export async function matchSteamGames(appIds: string[]) {
  const { results } = await request<{ results: Record<string, SteamMatch> }>(
    `/api/steam?ids=${appIds.join(',')}`,
  );
  return results;
}

export function getMedia(type: MediaType, sourceId: string, adult: boolean) {
  return request<Media>(
    `/api/${type}/${sourceId}${adult ? '?adult=true' : ''}`,
  );
}
