-- CreateEnum
CREATE TYPE "Segment" AS ENUM ('crude', 'product', 'mixed');

-- CreateEnum
CREATE TYPE "NewsSourceKind" AS ENUM ('rss', 'scraper');

-- CreateEnum
CREATE TYPE "EventSourceKind" AS ENUM ('news', 'x', 'manual');

-- CreateEnum
CREATE TYPE "AlertDirection" AS ENUM ('long', 'short');

-- CreateEnum
CREATE TYPE "AlertState" AS ENUM ('pending', 'delivered', 'held', 'cancelled');

-- CreateEnum
CREATE TYPE "RatingKind" AS ENUM ('instant_thumbs', '5d_followup');

-- CreateEnum
CREATE TYPE "RatingValue" AS ENUM ('up', 'down', 'right', 'wrong', 'unsure');

-- CreateEnum
CREATE TYPE "CronStatus" AS ENUM ('ok', 'error');

-- CreateTable
CREATE TABLE "tickers" (
    "id" SERIAL NOT NULL,
    "symbol" TEXT NOT NULL,
    "exchange" TEXT NOT NULL,
    "segment" "Segment" NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tickers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_sources" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "rss_url" TEXT,
    "kind" "NewsSourceKind" NOT NULL,
    "poll_interval_sec" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "news_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_items" (
    "id" SERIAL NOT NULL,
    "source_id" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body_text" TEXT,
    "published_at" TIMESTAMP(3),
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "content_hash" TEXT NOT NULL,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "news_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "x_accounts" (
    "id" SERIAL NOT NULL,
    "handle" TEXT NOT NULL,
    "display_name" TEXT,
    "follower_count" INTEGER,
    "signal_weight" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "x_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "x_posts" (
    "id" SERIAL NOT NULL,
    "account_id" INTEGER NOT NULL,
    "post_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "posted_at" TIMESTAMP(3) NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reply_to_id" TEXT,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "x_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_classes" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "default_factor_deltas" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_instances" (
    "id" SERIAL NOT NULL,
    "event_class_id" INTEGER NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "source_kind" "EventSourceKind" NOT NULL,
    "news_item_id" INTEGER,
    "x_post_id" INTEGER,
    "ticker_returns" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "factor_definitions" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "range_min" DOUBLE PRECISION NOT NULL,
    "range_max" DOUBLE PRECISION NOT NULL,
    "default_value" DOUBLE PRECISION NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "factor_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "factor_state" (
    "id" SERIAL NOT NULL,
    "ticker_id" INTEGER NOT NULL,
    "factor_id" INTEGER NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "factor_state_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "factor_state_history" (
    "id" SERIAL NOT NULL,
    "ticker_id" INTEGER NOT NULL,
    "factor_id" INTEGER NOT NULL,
    "old_value" DOUBLE PRECISION NOT NULL,
    "new_value" DOUBLE PRECISION NOT NULL,
    "delta" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "event_instance_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "factor_state_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" SERIAL NOT NULL,
    "ticker_id" INTEGER NOT NULL,
    "direction" "AlertDirection" NOT NULL,
    "entry_price" DOUBLE PRECISION NOT NULL,
    "thesis" TEXT NOT NULL,
    "top_catalyst" TEXT NOT NULL,
    "expected_return_5d" DOUBLE PRECISION NOT NULL,
    "hit_rate" DOUBLE PRECISION NOT NULL,
    "n_comparables" INTEGER NOT NULL,
    "invalidation" TEXT NOT NULL,
    "composite_score_at_fire" DOUBLE PRECISION NOT NULL,
    "state" "AlertState" NOT NULL DEFAULT 'pending',
    "fired_at" TIMESTAMP(3) NOT NULL,
    "delivered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_sources" (
    "id" SERIAL NOT NULL,
    "alert_id" INTEGER NOT NULL,
    "news_item_id" INTEGER,
    "x_post_id" INTEGER,
    "contribution_weight" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "alert_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_outcomes" (
    "id" SERIAL NOT NULL,
    "alert_id" INTEGER NOT NULL,
    "price_1d" DOUBLE PRECISION,
    "price_5d" DOUBLE PRECISION,
    "price_20d" DOUBLE PRECISION,
    "return_vs_ticker_1d" DOUBLE PRECISION,
    "return_vs_ticker_5d" DOUBLE PRECISION,
    "return_vs_ticker_20d" DOUBLE PRECISION,
    "return_vs_sector_1d" DOUBLE PRECISION,
    "return_vs_sector_5d" DOUBLE PRECISION,
    "return_vs_sector_20d" DOUBLE PRECISION,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alert_outcomes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ratings" (
    "id" SERIAL NOT NULL,
    "alert_id" INTEGER NOT NULL,
    "user_chat_id" TEXT NOT NULL,
    "kind" "RatingKind" NOT NULL,
    "value" "RatingValue" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prices_daily" (
    "id" SERIAL NOT NULL,
    "ticker_id" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "open" DOUBLE PRECISION NOT NULL,
    "high" DOUBLE PRECISION NOT NULL,
    "low" DOUBLE PRECISION NOT NULL,
    "close" DOUBLE PRECISION NOT NULL,
    "adj_close" DOUBLE PRECISION NOT NULL,
    "volume" BIGINT NOT NULL,

    CONSTRAINT "prices_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cron_runs" (
    "id" SERIAL NOT NULL,
    "job_name" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "finished_at" TIMESTAMP(3),
    "status" "CronStatus" NOT NULL,
    "error_msg" TEXT,
    "metrics" JSONB,

    CONSTRAINT "cron_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tickers_symbol_key" ON "tickers"("symbol");

-- CreateIndex
CREATE UNIQUE INDEX "news_items_url_key" ON "news_items"("url");

-- CreateIndex
CREATE INDEX "news_items_published_at_idx" ON "news_items"("published_at" DESC);

-- CreateIndex
CREATE INDEX "news_items_processed_at_idx" ON "news_items"("processed_at");

-- CreateIndex
CREATE UNIQUE INDEX "x_accounts_handle_key" ON "x_accounts"("handle");

-- CreateIndex
CREATE UNIQUE INDEX "x_posts_post_id_key" ON "x_posts"("post_id");

-- CreateIndex
CREATE INDEX "x_posts_posted_at_idx" ON "x_posts"("posted_at" DESC);

-- CreateIndex
CREATE INDEX "x_posts_processed_at_idx" ON "x_posts"("processed_at");

-- CreateIndex
CREATE UNIQUE INDEX "event_classes_slug_key" ON "event_classes"("slug");

-- CreateIndex
CREATE INDEX "event_instances_occurred_at_idx" ON "event_instances"("occurred_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "factor_definitions_slug_key" ON "factor_definitions"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "factor_state_ticker_id_factor_id_key" ON "factor_state"("ticker_id", "factor_id");

-- CreateIndex
CREATE INDEX "factor_state_history_ticker_id_factor_id_created_at_idx" ON "factor_state_history"("ticker_id", "factor_id", "created_at");

-- CreateIndex
CREATE INDEX "alerts_state_fired_at_idx" ON "alerts"("state", "fired_at");

-- CreateIndex
CREATE INDEX "alert_sources_alert_id_idx" ON "alert_sources"("alert_id");

-- CreateIndex
CREATE UNIQUE INDEX "alert_outcomes_alert_id_key" ON "alert_outcomes"("alert_id");

-- CreateIndex
CREATE INDEX "ratings_alert_id_idx" ON "ratings"("alert_id");

-- CreateIndex
CREATE UNIQUE INDEX "prices_daily_ticker_id_date_key" ON "prices_daily"("ticker_id", "date");

-- CreateIndex
CREATE INDEX "cron_runs_job_name_started_at_idx" ON "cron_runs"("job_name", "started_at" DESC);

-- AddForeignKey
ALTER TABLE "news_items" ADD CONSTRAINT "news_items_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "news_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "x_posts" ADD CONSTRAINT "x_posts_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "x_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_instances" ADD CONSTRAINT "event_instances_event_class_id_fkey" FOREIGN KEY ("event_class_id") REFERENCES "event_classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_instances" ADD CONSTRAINT "event_instances_news_item_id_fkey" FOREIGN KEY ("news_item_id") REFERENCES "news_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_instances" ADD CONSTRAINT "event_instances_x_post_id_fkey" FOREIGN KEY ("x_post_id") REFERENCES "x_posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factor_state" ADD CONSTRAINT "factor_state_ticker_id_fkey" FOREIGN KEY ("ticker_id") REFERENCES "tickers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factor_state" ADD CONSTRAINT "factor_state_factor_id_fkey" FOREIGN KEY ("factor_id") REFERENCES "factor_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factor_state_history" ADD CONSTRAINT "factor_state_history_ticker_id_fkey" FOREIGN KEY ("ticker_id") REFERENCES "tickers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factor_state_history" ADD CONSTRAINT "factor_state_history_factor_id_fkey" FOREIGN KEY ("factor_id") REFERENCES "factor_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factor_state_history" ADD CONSTRAINT "factor_state_history_event_instance_id_fkey" FOREIGN KEY ("event_instance_id") REFERENCES "event_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_ticker_id_fkey" FOREIGN KEY ("ticker_id") REFERENCES "tickers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_sources" ADD CONSTRAINT "alert_sources_alert_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "alerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_sources" ADD CONSTRAINT "alert_sources_news_item_id_fkey" FOREIGN KEY ("news_item_id") REFERENCES "news_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_sources" ADD CONSTRAINT "alert_sources_x_post_id_fkey" FOREIGN KEY ("x_post_id") REFERENCES "x_posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_outcomes" ADD CONSTRAINT "alert_outcomes_alert_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "alerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_alert_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "alerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prices_daily" ADD CONSTRAINT "prices_daily_ticker_id_fkey" FOREIGN KEY ("ticker_id") REFERENCES "tickers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
