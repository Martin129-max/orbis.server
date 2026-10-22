-- CreateEnum
CREATE TYPE "LibraryStatus" AS ENUM ('current', 'completed', 'on_hold', 'dropped', 'planned');

-- DropIndex
DROP INDEX "LibraryEntry_isPublic_createdAt_idx";

-- AlterTable
ALTER TABLE "LibraryEntry" ADD COLUMN     "status" "LibraryStatus" NOT NULL DEFAULT 'planned',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "LibraryActivity" (
    "id" SERIAL NOT NULL,
    "entryId" INTEGER NOT NULL,
    "status" "LibraryStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LibraryActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LibraryActivity_createdAt_idx" ON "LibraryActivity"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "LibraryActivity_entryId_idx" ON "LibraryActivity"("entryId");

-- AddForeignKey
ALTER TABLE "LibraryActivity" ADD CONSTRAINT "LibraryActivity_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "LibraryEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
