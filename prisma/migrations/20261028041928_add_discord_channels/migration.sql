-- CreateTable
CREATE TABLE "DiscordChannel" (
    "communityId" INTEGER NOT NULL,
    "webhookId" TEXT NOT NULL,
    "webhookToken" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "guildName" TEXT,
    "channelId" TEXT NOT NULL,
    "isForum" BOOLEAN NOT NULL DEFAULT false,
    "sendPosts" BOOLEAN NOT NULL DEFAULT true,
    "sendThreads" BOOLEAN NOT NULL DEFAULT true,
    "sendLibrary" BOOLEAN NOT NULL DEFAULT true,
    "lostAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscordChannel_pkey" PRIMARY KEY ("communityId")
);

-- CreateTable
CREATE TABLE "DiscordMessage" (
    "id" SERIAL NOT NULL,
    "communityId" INTEGER NOT NULL,
    "targetType" "CommentableType" NOT NULL,
    "targetId" INTEGER NOT NULL,
    "messageId" TEXT NOT NULL,
    "threadId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscordMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DiscordMessage_targetType_targetId_idx" ON "DiscordMessage"("targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "DiscordMessage_communityId_targetType_targetId_key" ON "DiscordMessage"("communityId", "targetType", "targetId");

-- AddForeignKey
ALTER TABLE "DiscordChannel" ADD CONSTRAINT "DiscordChannel_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscordMessage" ADD CONSTRAINT "DiscordMessage_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "DiscordChannel"("communityId") ON DELETE CASCADE ON UPDATE CASCADE;
