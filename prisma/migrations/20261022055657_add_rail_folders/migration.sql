-- AlterTable
ALTER TABLE "Membership" ADD COLUMN     "folderId" INTEGER;

-- CreateTable
CREATE TABLE "RailFolder" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "name" TEXT,
    "color" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RailFolder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RailFolder_userId_idx" ON "RailFolder"("userId");

-- CreateIndex
CREATE INDEX "Membership_folderId_idx" ON "Membership"("folderId");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "RailFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RailFolder" ADD CONSTRAINT "RailFolder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
