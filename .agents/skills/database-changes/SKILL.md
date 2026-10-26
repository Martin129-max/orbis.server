---
name: database-changes
description: Make database changes in the Orbis server safely, covering Prisma schema files, migrations, the generated client, and the seed. Use whenever you change anything in prisma/schema/, add or edit a migration, or add or change a model, field, enum, or relation.
---

# Database Changes

## Where Schema Changes Go

The Prisma schema is split by area in `prisma/schema/`: `schema.prisma` holds the generator and datasource, and each other file holds one area's models and enums (for example `user`, `community`, `content`, `library`, `steam`). Put a new model or enum in the file for its area, or add a new file when it starts a new area. Relations work across files.

## Workflow

1. Make sure the local database is running: `docker ps` should list `orbis_server_db`. Start it with `pnpm db:start` if it isn't.
2. Edit the schema.
3. Create the migration right away with `pnpm prisma:migrate <name>`, and commit the new folder in `prisma/migrations/` together with the schema change. `pnpm run pull` rebuilds everyone's local database from migrations only, so a schema change without its migration stops it for everyone.
4. Regenerate the client with `pnpm prisma:generate`. `migrate dev` doesn't do it, so the code won't see new fields until you do.
5. Update `prisma/seed.ts` in the same change, so it runs against the new schema and fills any new fields, models, or relations with realistic data that follows the seed conventions below.
6. Typecheck and test: `npx tsc --noEmit -p tsconfig.json` (this covers the seed too) and `npx jest`.
7. Check that the seed still runs. `pnpm prisma:seed` deletes everything in the local database and replaces it with seed data, so ask the user before running it. If they'd rather keep their data, say that the seed was only typechecked.

## Seed Conventions

- Characters and communities are anime-themed.
- `admin@user.com` (username `admin`, password `123456`) is a site admin and one of two non-anime users. Keep it a member of several communities, with friends and pending friend requests, so every feature has data when logging in as admin.
- `user@user.com` (username `user`, password `123456`) is a normal, non-admin user who signed up recently. Leave its tour and new-user checklist unfinished (`tourCompletedAt` and `checklistDismissedAt` stay null) so the onboarding experience can be tried by logging in as it.
- Character accounts use `<character>@anime.test` with the username `<character>` and the password `password`.

## Rules

- Never run `prisma migrate reset`, the seed, or anything else that deletes data without the user's go-ahead, and never against a database other than the local Orbis one (`localhost:5434/orbis_server_db`).
- Don't edit a migration that has already been applied or committed. Add a new one instead.
- New columns on tables that already have rows need a default or must be nullable.
