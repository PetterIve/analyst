export interface FactorDef {
  id: number
  slug: string
  rangeMin: number
  rangeMax: number
  defaultValue: number
  weight: number
  /** Half-life in days for decay toward 0. `null` = no decay (structural). */
  decayHalfLifeDays: number | null
}

export interface FactorStateRow {
  tickerId: number
  factorId: number
  value: number
  updatedAt: Date
}

export interface FactorDelta {
  factorSlug: string
  delta: number
  reason: string
}

export interface CandidateInput {
  id: number
  sourceKind: 'news' | 'x' | 'manual'
  sourceRefId: number
  eventClassSlug: string | null
  createdAt: Date
  affectedTickers: Array<{ symbol: string; confidence: number }>
  sentiment: 'bullish' | 'bearish' | 'neutral'
  /** Deltas proposed by the LLM; if empty the engine falls back to event class defaults. */
  proposedFactorDeltas: FactorDelta[]
  overallConfidence: number
  excerpt: string
}

export interface CompositeScore {
  tickerId: number
  symbol: string
  longScore: number
  shortScore: number
  /** Per-factor contribution = value × weight. Positive pushes long, negative pushes short. */
  contributions: Array<{ factorSlug: string; value: number; weight: number; contribution: number }>
}

export type AlertDirection = 'long' | 'short'

export interface TriggerProposal {
  tickerId: number
  symbol: string
  direction: AlertDirection
  compositeScore: number
  contributingCandidateIds: number[]
  topCandidateId: number
  topExcerpt: string
  topEventClassSlug: string | null
}
