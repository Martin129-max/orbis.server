-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('todo', 'in_progress', 'done');

-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "status" "ReportStatus" NOT NULL DEFAULT 'todo';
