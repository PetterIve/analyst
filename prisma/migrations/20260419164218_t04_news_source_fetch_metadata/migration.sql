-- AlterTable
ALTER TABLE "news_sources" ADD COLUMN     "last_error" TEXT,
ADD COLUMN     "last_fetched_at" TIMESTAMP(3);
