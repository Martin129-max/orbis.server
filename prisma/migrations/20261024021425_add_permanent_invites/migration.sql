-- AlterTable
ALTER TABLE "Invite" ADD COLUMN     "disabledAt" TIMESTAMP(3),
ADD COLUMN     "permanent" BOOLEAN NOT NULL DEFAULT false;
