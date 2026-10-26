# Agent Instructions

## Schema Files

The Prisma schema is split by area in `prisma/schema/`: `schema.prisma` holds the generator and datasource, and each other file holds one area's models and enums (`user`, `community`, `content`, `friendship`, `report`, `notification`). Put a new model or enum in the file for its area, or add a new file when it starts a new area. Relations work across files.

## Database Changes

Whenever you change anything database-related (a file in `prisma/schema/`, a migration, or a new model, field, enum, or relation), update `prisma/seed.ts` in the same change so the seed:

- Runs without errors against the new schema.
- Fills in any new fields, models, or relations with realistic data, so the site looks alive after seeding.

Run `pnpm prisma:seed` afterwards to confirm it still works.

Create the migration in the same change too: run `pnpm prisma:migrate <name>` right after editing `prisma/schema/`, and commit the new folder in `prisma/migrations/` together with the schema change. `pnpm run pull` rebuilds the local database from migrations only, so a schema change without its migration stops it for everyone.

### Seed Conventions

- Characters and communities are anime-themed.
- `admin@user.com` (username `admin`, password `123456`) is a site admin and one of two non-anime users. Keep it a member of several communities, with friends and pending friend requests, so every feature has data when logging in as admin.
- `user@user.com` (username `user`, password `123456`) is a normal, non-admin user who signed up recently. Leave its tour and new-user checklist unfinished (`tourCompletedAt` and `checklistDismissedAt` stay null) so the onboarding experience can be tried by logging in as it.
- Character accounts use `<character>@anime.test` with the username `<character>` and the password `password`.

## Search

The site has one search modal (see "Keep Search Up to Date" in `web/AGENTS.md`). When you add or change content people could look for by name or text, add or update its search endpoint in the same change. Use the same visibility rules as wherever that content is listed: private communities and profiles, reported or hidden content (`visibleTo` and `reportedBy`), and the viewer's NSFW setting. Require at least two characters, cap the query length and the number of results, and rate-limit the route. `PostsService.searchFeed` (`GET /feed/search`) is the example to follow.

## Image Uploads

Every uploaded image must go through `StorageService.uploadImage` (`src/storage/storage.service.ts`), never a direct `PutObjectCommand`. It rejects files over 10 MB (`IMAGE_MAX_BYTES`), fixes the orientation, shrinks the image to fit a maximum size without enlarging it, and converts it to WebP, so nothing is stored as uploaded.

When you add an upload endpoint:

- Use `FileInterceptor('file', { limits: { fileSize: IMAGE_MAX_BYTES } })` on the route.
- Pass a `maxSize` that fits where the image is shown. Current sizes: avatars 384, community icons 512, covers 1600, backgrounds 1920.
- Use a folder named for the image's purpose (for example `avatars` or `user-covers`).
- When an image is replaced or removed, delete the old file with `StorageService.delete`, using `keyFor` to get its key.
