import type {
  AlertDirection,
  CandidateInput,
  CompositeScore,
  TriggerProposal,
} from './types'

export type { TriggerProposal } from './types'

export interface TriggerConfig {
  /** Composite score magnitude that qualifies a ticker/direction. */
  scoreThreshold: number
  /** Minimum number of supporting candidates required in the window. */
  minSupportingCandidates: number
  /** Window in ms over which supporting candidates are counted. */
  supportingWindowMs: number
  /** Cooldown in ms: no new alert for the same ticker/direction within this window. */
  cooldownMs: number
}

export const DEFAULT_TRIGGER_CONFIG: TriggerConfig = {
  scoreThreshold: 2.0,
  minSupportingCandidates: 2,
  supportingWindowMs: 24 * 60 * 60 * 1000,
  cooldownMs: 48 * 60 * 60 * 1000,
}

export interface RecentAlertRef {
  tickerId: number
  direction: AlertDirection
  firedAt: Date
}

export interface TriggerInputs {
  now: Date
  composites: ReadonlyArray<CompositeScore>
  /**
   * Recent candidates across all tickers. A candidate supports a
   * ticker/direction when its `affectedTickers` list includes the ticker AND
   * its sentiment aligns with the direction (bullish→long, bearish→short).
   */
  recentCandidates: ReadonlyArray<CandidateInput & { tickerId: number }>
  /** Any alerts fired within the cooldown window. */
  recentAlerts: ReadonlyArray<RecentAlertRef>
  config?: Partial<TriggerConfig>
}

function sentimentMatchesDirection(sentiment: CandidateInput['sentiment'], direction: AlertDirection): boolean {
  if (direction === 'long') return sentiment === 'bullish'
  return sentiment === 'bearish'
}

/**
 * Evaluate every (ticker, direction) slot against the confirmation rules.
 * Pure — the orchestrator handles DB reads/writes and turns these proposals
 * into `Alert` rows.
 */
export function evaluateTriggers(inputs: TriggerInputs): TriggerProposal[] {
  const cfg = { ...DEFAULT_TRIGGER_CONFIG, ...inputs.config }
  const nowMs = inputs.now.getTime()
  const windowStart = nowMs - cfg.supportingWindowMs
  const cooldownStart = nowMs - cfg.cooldownMs

  const proposals: TriggerProposal[] = []

  for (const score of inputs.composites) {
    for (const direction of ['long', 'short'] as const) {
      const magnitude = direction === 'long' ? score.longScore : score.shortScore
      if (magnitude < cfg.scoreThreshold) continue

      const inCooldown = inputs.recentAlerts.some(
        (a) =>
          a.tickerId === score.tickerId &&
          a.direction === direction &&
          a.firedAt.getTime() >= cooldownStart,
      )
      if (inCooldown) continue

      const supporting = inputs.recentCandidates.filter(
        (c) =>
          c.tickerId === score.tickerId &&
          c.createdAt.getTime() >= windowStart &&
          sentimentMatchesDirection(c.sentiment, direction),
      )
      if (supporting.length < cfg.minSupportingCandidates) continue

      // Top catalyst = highest-confidence supporting candidate.
      const sorted = [...supporting].sort((a, b) => b.overallConfidence - a.overallConfidence)
      const top = sorted[0]

      proposals.push({
        tickerId: score.tickerId,
        symbol: score.symbol,
        direction,
        compositeScore: magnitude,
        contributingCandidateIds: supporting.map((c) => c.id),
        topCandidateId: top.id,
        topExcerpt: top.excerpt,
        topEventClassSlug: top.eventClassSlug,
      })
    }
  }

  return proposals
}
