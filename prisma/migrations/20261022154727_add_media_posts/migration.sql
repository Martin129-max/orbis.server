-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "mediaSourceId" TEXT,
ADD COLUMN     "mediaType" "MediaType";

-- CreateIndex
CREATE INDEX "Post_mediaType_mediaSourceId_createdAt_idx" ON "Post"("mediaType", "mediaSourceId", "createdAt" DESC);

-- AlterCheckConstraint
ALTER TABLE "Post" DROP CONSTRAINT "Post_one_home_check";
ALTER TABLE "Post" ADD CONSTRAINT "Post_one_home_check" CHECK (
  (("communityId" IS NOT NULL)::int + ("wallUserId" IS NOT NULL)::int + ("mediaType" IS NOT NULL)::int) = 1
  AND ("mediaType" IS NULL) = ("mediaSourceId" IS NULL)
);
