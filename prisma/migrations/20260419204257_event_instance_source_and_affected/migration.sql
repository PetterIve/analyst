-- AlterTable
-- `affected_symbols` defaults to `'[]'::jsonb` so applying this migration to a
-- table that already has rows is safe (existing instances become "no tickers
-- tracked" — recomputable via the admin "Recompute returns" button once
-- their affected_symbols list is filled in). New writes always set the column
-- explicitly via the seed / tRPC create mutation.
ALTER TABLE "event_instances"
ADD COLUMN "source_url" TEXT,
ADD COLUMN "affected_symbols" JSONB NOT NULL DEFAULT '[]'::jsonb;
