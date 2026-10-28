-- AlterTable
ALTER TABLE "Community" ADD COLUMN     "showDiscordOnline" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "showTwitchClips" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "showTwitchLive" BOOLEAN NOT NULL DEFAULT true;
