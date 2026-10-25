import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  LibraryStatus,
  MediaType,
  Prisma,
} from '../../prisma/generated/client';
import { author } from '../common/author';
import { AddLibraryEntryDto } from './dto/add-library-entry.dto';
import { UpdateLibraryEntryDto } from './dto/update-library-entry.dto';
import { getMedia, Media, searchMedia } from './library-api';

const PROGRESS_MERGE_WINDOW = 5 * 60 * 1000;

const entrySelect = {
  id: true,
  mediaId: true,
  mediaType: true,
  sourceId: true,
  title: true,
  coverImage: true,
  year: true,
  status: true,
  progress: true,
  total: true,
  isPublic: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type LibraryEntryView = Prisma.LibraryEntryGetPayload<{
  select: typeof entrySelect;
}>;

function totalOf(media: Media) {
  const count =
    media.details?.[media.type === 'MANGA' ? 'chapters' : 'episodes'];
  return media.type !== 'GAME' && typeof count === 'number' && count > 0
    ? count
    : null;
}

const toResult = (media: Media) => ({
  id: media.id,
  type: media.type.toLowerCase() as 'anime' | 'manga' | 'game',
  sourceId: media.sourceId,
  title: media.title,
  coverImage: media.coverImage,
  year: media.year,
  score: media.score,
});

@Injectable()
export class LibraryService {
  constructor(private prisma: PrismaService) {}

  async search(userId: number, q?: string) {
    const query = q?.trim() ?? '';
    if (query.length < 2 || query.length > 100) {
      throw new BadRequestException('Search for 2 to 100 characters');
    }

    const results = await searchMedia(query);
    const all = [...results.anime, ...results.manga, ...results.game];
    const saved = await this.prisma.libraryEntry.findMany({
      where: { userId, mediaId: { in: all.map(({ id }) => id) } },
      select: { mediaId: true },
    });
    const savedIds = new Set(saved.map(({ mediaId }) => mediaId));
    const mark = (list: Media[]) =>
      list.map((media) => ({
        ...toResult(media),
        inLibrary: savedIds.has(media.id),
      }));

    return {
      anime: mark(results.anime),
      manga: mark(results.manga),
      game: mark(results.game),
    };
  }

  async media(userId: number, type: MediaType, sourceId: string) {
    if (!/^\d{1,12}$/.test(sourceId)) {
      throw new NotFoundException('Title not found');
    }

    const media = await getMedia(type, sourceId);
    const [entry, others] = await Promise.all([
      this.prisma.libraryEntry.findUnique({
        where: { userId_mediaId: { userId, mediaId: media.id } },
        select: entrySelect,
      }),
      this.prisma.libraryEntry.findMany({
        where: {
          mediaId: media.id,
          isPublic: true,
          userId: { not: userId },
          user: {
            memberships: {
              some: { community: { memberships: { some: { userId } } } },
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: 12,
        select: { status: true, user: author },
      }),
    ]);

    return {
      ...toResult(media),
      altTitles: media.altTitles ?? [],
      synopsis: media.synopsis ?? null,
      bannerImage: media.bannerImage ?? null,
      releaseStatus: media.status ?? null,
      genres: media.genres ?? [],
      source: media.source ?? null,
      details: media.details ?? {},
      entry,
      members: others.map(({ status, user }) => ({ status, user })),
    };
  }

  list(userId: number): Promise<LibraryEntryView[]> {
    return this.prisma.libraryEntry.findMany({
      where: { userId },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      select: entrySelect,
    });
  }

  async add(
    userId: number,
    {
      type,
      sourceId,
      status = 'planned',
      isPublic = true,
      progress = 0,
    }: AddLibraryEntryDto,
  ): Promise<LibraryEntryView> {
    const media = await getMedia(type, sourceId);
    const total = totalOf(media);
    const initialProgress =
      type === 'game'
        ? 0
        : status === 'completed' && total !== null
          ? total
          : Math.min(progress, total ?? progress);

    try {
      return await this.prisma.libraryEntry.create({
        data: {
          userId,
          mediaId: media.id,
          mediaType: type,
          sourceId: media.sourceId,
          title: media.title,
          coverImage: media.coverImage,
          year: media.year,
          status,
          progress: initialProgress,
          total,
          isPublic,
          activities: { create: { status } },
        },
        select: entrySelect,
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('Already in your library');
      }
      throw e;
    }
  }

  async update(
    userId: number,
    id: number,
    { status, isPublic, progress }: UpdateLibraryEntryDto,
  ): Promise<LibraryEntryView> {
    const entry = await this.prisma.libraryEntry.findFirst({
      where: { id, userId },
      select: { status: true, progress: true, total: true, mediaType: true },
    });
    if (!entry) throw new NotFoundException('Library entry not found');

    let nextProgress =
      progress === undefined
        ? undefined
        : Math.min(progress, entry.total ?? progress);
    let nextStatus = status;
    if (status === 'completed' && entry.total !== null) {
      nextProgress = entry.total;
    } else if (
      status === undefined &&
      nextProgress !== undefined &&
      entry.total !== null &&
      nextProgress >= entry.total
    ) {
      nextStatus = 'completed';
    } else if (
      status === undefined &&
      nextProgress !== undefined &&
      nextProgress > 0 &&
      entry.status === 'planned'
    ) {
      nextStatus = 'current';
    }

    const statusChanged =
      nextStatus !== undefined && nextStatus !== entry.status;
    const updated = await this.prisma.libraryEntry.update({
      where: { id },
      data: {
        status: nextStatus,
        progress: nextProgress,
        isPublic,
        ...(statusChanged && {
          activities: { create: { status: nextStatus } },
        }),
      },
      select: entrySelect,
    });

    if (entry.mediaType !== 'game' && updated.progress !== entry.progress) {
      await this.logProgress(
        id,
        updated.status,
        entry.progress,
        updated.progress,
      );
    }
    return updated;
  }

  private async logProgress(
    entryId: number,
    status: LibraryStatus,
    before: number,
    after: number,
  ) {
    const recent = await this.prisma.libraryActivity.findFirst({
      where: {
        entryId,
        progressTo: { not: null },
        createdAt: { gte: new Date(Date.now() - PROGRESS_MERGE_WINDOW) },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { id: true, progressFrom: true },
    });

    if (recent) {
      if (after < recent.progressFrom!) {
        await this.deleteActivities([recent.id]);
      } else {
        await this.prisma.libraryActivity.update({
          where: { id: recent.id },
          data: { progressTo: after, status, createdAt: new Date() },
        });
      }
    } else if (after > before) {
      await this.prisma.libraryActivity.create({
        data: { entryId, status, progressFrom: before + 1, progressTo: after },
      });
    }
  }

  async remove(userId: number, id: number) {
    await this.ownEntry(userId, id);
    const activities = await this.prisma.libraryActivity.findMany({
      where: { entryId: id },
      select: { id: true },
    });
    await this.deleteActivities(activities.map((activity) => activity.id));
    await this.prisma.libraryEntry.delete({ where: { id } });
  }

  private async deleteActivities(ids: number[]) {
    if (ids.length === 0) return;
    const comments = await this.prisma.comment.findMany({
      where: { commentableType: 'activity', commentableId: { in: ids } },
      select: { id: true },
    });
    await this.prisma.$transaction([
      this.prisma.vote.deleteMany({
        where: {
          votableType: 'comment',
          votableId: { in: comments.map((comment) => comment.id) },
        },
      }),
      this.prisma.comment.deleteMany({
        where: { commentableType: 'activity', commentableId: { in: ids } },
      }),
      this.prisma.like.deleteMany({
        where: { likeableType: 'activity', likeableId: { in: ids } },
      }),
      this.prisma.libraryActivity.deleteMany({ where: { id: { in: ids } } }),
    ]);
  }

  private async ownEntry(userId: number, id: number) {
    const entry = await this.prisma.libraryEntry.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!entry) throw new NotFoundException('Library entry not found');
  }
}
