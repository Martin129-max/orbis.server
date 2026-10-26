-- AlterTable
ALTER TABLE "LibraryEntry" ADD COLUMN     "isAdult" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "showNsfw" BOOLEAN NOT NULL DEFAULT false;

