import { z } from 'zod'

/**
 * The structured output the extractor produces per source item.
 *
 * A `null` `eventClassSlug` means "no tanker-relevant event" — the item is
 * still marked processed so we don't re-extract. `overallConfidence` is the
 * model's self-assessed 0..1 for the overall classification; per-ticker
 * `confidence` is the separate per-affected-ticker belief.
 */
export const eventCandidateSchema = z.object({
  eventClassSlug: z.string().min(1).max(100).nullable(),
  affectedTickers: z
    .array(
      z.object({
        symbol: z.string().min(1).max(20),
        confidence: z.number().min(0).max(1),
      }),
    )
    .max(50),
  sentiment: z.enum(['bullish', 'bearish', 'neutral']),
  proposedFactorDeltas: z
    .array(
      z.object({
        factorSlug: z.string().min(1).max(100),
        delta: z.number().min(-2).max(2),
        reason: z.string().min(1).max(500),
      }),
    )
    .max(20),
  overallConfidence: z.number().min(0).max(1),
  excerpt: z.string().min(1).max(2000),
})

export type EventCandidate = z.infer<typeof eventCandidateSchema>

/**
 * JSON Schema for the `submit_candidate` Anthropic tool. Kept in sync with
 * `eventCandidateSchema` above — the Zod schema is the runtime source of
 * truth, this shape is what we ship to the model.
 */
export interface CandidateToolSchema {
  type: 'object'
  properties: Record<string, unknown>
  required: string[]
  [k: string]: unknown
}

export const candidateToolSchema: CandidateToolSchema = {
  type: 'object',
  properties: {
    eventClassSlug: {
      type: ['string', 'null'],
      description:
        'Slug of a known event class, or null if the text is not tanker-relevant.',
    },
    affectedTickers: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          symbol: { type: 'string' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
        },
        required: ['symbol', 'confidence'],
      },
      description:
        'Tickers from the locked universe that are materially affected.',
    },
    sentiment: {
      type: 'string',
      enum: ['bullish', 'bearish', 'neutral'],
    },
    proposedFactorDeltas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          factorSlug: { type: 'string' },
          delta: { type: 'number', minimum: -2, maximum: 2 },
          reason: { type: 'string' },
        },
        required: ['factorSlug', 'delta', 'reason'],
      },
      description:
        'Optional per-factor deltas. Leave empty to accept the event class defaults; override only when the text gives a specific reason.',
    },
    overallConfidence: { type: 'number', minimum: 0, maximum: 1 },
    excerpt: {
      type: 'string',
      description:
        'Short quoted passage from the input that justifies the classification.',
    },
  },
  required: [
    'eventClassSlug',
    'affectedTickers',
    'sentiment',
    'proposedFactorDeltas',
    'overallConfidence',
    'excerpt',
  ],
}
