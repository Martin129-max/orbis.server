-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'wall_post';

-- AlterTable
ALTER TABLE "Comment" ALTER COLUMN "communityId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "wallUserId" INTEGER,
ALTER COLUMN "communityId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Vote" ALTER COLUMN "communityId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Post_wallUserId_createdAt_idx" ON "Post"("wallUserId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_wallUserId_fkey" FOREIGN KEY ("wallUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddCheckConstraint
ALTER TABLE "Post" ADD CONSTRAINT "Post_one_home_check" CHECK (("communityId" IS NULL) <> ("wallUserId" IS NULL));
