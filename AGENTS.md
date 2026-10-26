# Agent Instructions

## Skills

Step-by-step instructions live in skills in `.agents/skills/`, linked as `.claude/skills/` for Claude Code. Any agent can also read them as plain files. Whenever one of these situations applies, follow its skill in the same change:

- **Changing anything database-related** (a file in `prisma/schema/`, a migration, or a model, field, enum, or relation) → `database-changes` (`.agents/skills/database-changes/SKILL.md`): put it in the right schema file, create the migration, regenerate the client, and update the seed. Running the seed wipes local data, so ask first.
- **Adding or changing an image upload, or replacing or removing a stored image** → `image-uploads` (`.agents/skills/image-uploads/SKILL.md`): every upload goes through `StorageService.uploadImage`, sized for where it's shown.
- **Adding or changing content people could look up by name or text** → `search-endpoints` (`.agents/skills/search-endpoints/SKILL.md`): add or update its search endpoint, with the same visibility rules as wherever it's listed.
