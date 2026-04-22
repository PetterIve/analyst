-- AlterTable: add scheduled-delivery + cancellation fields for T09 alert engine
ALTER TABLE "alerts"
    ADD COLUMN "deliver_at" TIMESTAMP(3),
    ADD COLUMN "cancel_reason" TEXT;
