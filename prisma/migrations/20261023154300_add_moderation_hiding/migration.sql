-- AlterTable
ALTER TABLE "Comment" ADD COLUMN     "hiddenAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "hiddenAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Thread" ADD COLUMN     "hiddenAt" TIMESTAMP(3);

