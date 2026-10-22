-- CreateEnum
CREATE TYPE "LikeableType" AS ENUM ('post', 'activity');

-- AlterEnum
ALTER TYPE "CommentableType" ADD VALUE 'activity';

-- AlterTable
ALTER TABLE "LibraryActivity" ADD COLUMN     "commentCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "likeCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "likeCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Like" (
    "userId" INTEGER NOT NULL,
    "likeableType" "LikeableType" NOT NULL,
    "likeableId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Like_pkey" PRIMARY KEY ("userId","likeableType","likeableId")
);

-- CreateIndex
CREATE INDEX "Like_likeableType_likeableId_idx" ON "Like"("likeableType", "likeableId");

-- AddForeignKey
ALTER TABLE "Like" ADD CONSTRAINT "Like_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
