-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "creatorId" INTEGER,
ADD COLUMN     "isGroup" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "name" TEXT,
ALTER COLUMN "userAId" DROP NOT NULL,
ALTER COLUMN "userBId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "system" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Conversation_creatorId_idx" ON "Conversation"("creatorId");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
