-- AlterTable
ALTER TABLE "LibraryEntry" ADD COLUMN     "progress" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "total" INTEGER;
