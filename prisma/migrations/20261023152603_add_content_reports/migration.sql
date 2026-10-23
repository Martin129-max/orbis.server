-- CreateEnum
CREATE TYPE "ContentReportTarget" AS ENUM ('post', 'thread', 'comment', 'user', 'community');

-- CreateEnum
CREATE TYPE "ContentReportReason" AS ENUM ('spam', 'harassment', 'inappropriate', 'other');

-- CreateEnum
CREATE TYPE "ContentReportResolution" AS ENUM ('resolved', 'dismissed');

-- CreateTable
CREATE TABLE "ContentReport" (
    "id" SERIAL NOT NULL,
    "reporterId" INTEGER NOT NULL,
    "targetType" "ContentReportTarget" NOT NULL,
    "targetId" INTEGER NOT NULL,
    "reason" "ContentReportReason" NOT NULL,
    "details" TEXT,
    "resolution" "ContentReportResolution",
    "resolvedById" INTEGER,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContentReport_targetType_targetId_idx" ON "ContentReport"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "ContentReport_resolvedAt_idx" ON "ContentReport"("resolvedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ContentReport_reporterId_targetType_targetId_key" ON "ContentReport"("reporterId", "targetType", "targetId");

-- AddForeignKey
ALTER TABLE "ContentReport" ADD CONSTRAINT "ContentReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentReport" ADD CONSTRAINT "ContentReport_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

