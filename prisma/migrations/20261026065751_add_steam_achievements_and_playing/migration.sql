-- AlterTable
ALTER TABLE "SteamAccount" ADD COLUMN     "showPlaying" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "SteamGame" ADD COLUMN     "achieved" INTEGER,
ADD COLUMN     "achievementTotal" INTEGER,
ADD COLUMN     "achievementsAt" TIMESTAMP(3);
