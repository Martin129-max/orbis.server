# Agent Instructions

## Database Changes

Whenever you change anything database-related (`prisma/schema.prisma`, a migration, or a new model, field, enum, or relation), update `prisma/seed.ts` in the same change so the seed:

- Runs without errors against the new schema.
- Fills in any new fields, models, or relations with realistic data, so the site looks alive after seeding.

Run `pnpm prisma:seed` afterwards to confirm it still works.

### Seed Conventions

- Characters and communities are anime-themed.
- `admin@user.com` (username `admin`, password `123456`) is a site admin and one of two non-anime users. Keep it a member of several communities, with friends and pending friend requests, so every feature has data when logging in as admin.
- `user@user.com` (username `user`, password `123456`) is a normal, non-admin user who signed up recently. Leave its tour and new-user checklist unfinished (`tourCompletedAt` and `checklistDismissedAt` stay null) so the onboarding experience can be tried by logging in as it.
- Character accounts use `<character>@anime.test` with the username `<character>` and the password `password`.
