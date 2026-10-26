-- AlterTable
ALTER TABLE "LibraryEntry" ADD COLUMN     "steamAppId" TEXT;

-- CreateTable
CREATE TABLE "SteamAccount" (
    "userId" INTEGER NOT NULL,
    "steamId" TEXT NOT NULL,
    "personaName" TEXT NOT NULL,
    "trackGames" BOOLEAN NOT NULL DEFAULT false,
    "gamesPrivate" BOOLEAN NOT NULL DEFAULT false,
    "baselineAt" TIMESTAMP(3),
    "checkedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SteamAccount_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "SteamGame" (
    "userId" INTEGER NOT NULL,
    "appId" TEXT NOT NULL,
    "minutes" INTEGER NOT NULL DEFAULT 0,
    "lastPlayedAt" TIMESTAMP(3),
    "igdbId" TEXT,
    "matchedAt" TIMESTAMP(3),

    CONSTRAINT "SteamGame_pkey" PRIMARY KEY ("userId","appId")
);

-- CreateIndex
CREATE UNIQUE INDEX "SteamAccount_steamId_key" ON "SteamAccount"("steamId");

-- CreateIndex
CREATE INDEX "SteamGame_userId_igdbId_idx" ON "SteamGame"("userId", "igdbId");

-- AddForeignKey
ALTER TABLE "SteamAccount" ADD CONSTRAINT "SteamAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SteamGame" ADD CONSTRAINT "SteamGame_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
