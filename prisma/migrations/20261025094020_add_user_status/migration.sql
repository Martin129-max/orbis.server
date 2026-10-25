-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('online', 'idle', 'busy');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "status" "UserStatus" NOT NULL DEFAULT 'online';
