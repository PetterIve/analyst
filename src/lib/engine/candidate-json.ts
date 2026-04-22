import { eventCandidateSchema } from '#/lib/extractor/schema'
import type { EventCandidate } from '#/lib/extractor/schema'

/**
 * Parse the `extracted_json` column into the shape the extractor wrote.
 * The DB stores it as `Json` (unknown); validating with the same Zod schema
 * the extractor used keeps the engine honest about its contract.
 *
 * Returns `null` if the blob is malformed — the engine logs and skips that
 * candidate rather than crashing the tick.
 */
export function parseExtractedCandidate(raw: unknown): EventCandidate | null {
  const parsed = eventCandidateSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}
