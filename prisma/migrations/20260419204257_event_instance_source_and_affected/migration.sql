/*
  Warnings:

  - Added the required column `affected_symbols` to the `event_instances` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "event_instances" ADD COLUMN     "affected_symbols" JSONB NOT NULL,
ADD COLUMN     "source_url" TEXT;
