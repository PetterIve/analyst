-- CreateTable
CREATE TABLE "event_candidates" (
    "id" SERIAL NOT NULL,
    "source_kind" "EventSourceKind" NOT NULL,
    "source_ref_id" INTEGER NOT NULL,
    "extracted_json" JSONB NOT NULL,
    "event_class_id" INTEGER,
    "overall_confidence" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumed_at" TIMESTAMP(3),

    CONSTRAINT "event_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "event_candidates_source_kind_source_ref_id_idx" ON "event_candidates"("source_kind", "source_ref_id");

-- CreateIndex
CREATE INDEX "event_candidates_event_class_id_idx" ON "event_candidates"("event_class_id");

-- CreateIndex
CREATE INDEX "event_candidates_consumed_at_idx" ON "event_candidates"("consumed_at");

-- CreateIndex
CREATE INDEX "event_candidates_created_at_idx" ON "event_candidates"("created_at" DESC);

-- AddForeignKey
ALTER TABLE "event_candidates" ADD CONSTRAINT "event_candidates_event_class_id_fkey" FOREIGN KEY ("event_class_id") REFERENCES "event_classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
