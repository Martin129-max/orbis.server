-- CreateEnum
CREATE TYPE "Theme" AS ENUM ('system', 'light', 'dark');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "theme" "Theme" NOT NULL DEFAULT 'system';
