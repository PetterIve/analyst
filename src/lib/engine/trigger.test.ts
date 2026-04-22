import { describe, expect, it } from 'vitest'
import { evaluateTriggers } from './trigger'
import type { CandidateInput, CompositeScore } from './types'

const HOUR = 60 * 60 * 1000
const NOW = new Date('2025-06-15T14:00:00Z')

function mkCandidate(
  id: number,
  tickerId: number,
  sentiment: CandidateInput['sentiment'],
  hoursAgo: number,
  confidence = 0.7,
): CandidateInput & { tickerId: number } {
  return {
    id,
    tickerId,
    sourceKind: 'news',
    sourceRefId: id * 100,
    eventClassSlug: 'sample_event',
    createdAt: new Date(NOW.getTime() - hoursAgo * HOUR),
    affectedTickers: [{ symbol: 'FRO', confidence }],
    sentiment,
    proposedFactorDeltas: [],
    overallConfidence: confidence,
    excerpt: `c${id}`,
  }
}

function mkComposite(tickerId: number, long: number, short: number): CompositeScore {
  return {
    tickerId,
    symbol: 'FRO',
    longScore: long,
    shortScore: short,
    contributions: [],
  }
}

describe('evaluateTriggers', () => {
  it('fires when score crosses threshold and 2 supporting candidates arrived in 24h', () => {
    const proposals = evaluateTriggers({
      now: NOW,
      composites: [mkComposite(10, 2.3, 0)],
      recentCandidates: [
        mkCandidate(1, 10, 'bullish', 3),
        mkCandidate(2, 10, 'bullish', 12, 0.85),
      ],
      recentAlerts: [],
    })
    expect(proposals).toHaveLength(1)
    expect(proposals[0].direction).toBe('long')
    expect(proposals[0].topCandidateId).toBe(2) // higher confidence
  })

  it('does not fire when score is below threshold', () => {
    const proposals = evaluateTriggers({
      now: NOW,
      composites: [mkComposite(10, 1.8, 0)],
      recentCandidates: [mkCandidate(1, 10, 'bullish', 3), mkCandidate(2, 10, 'bullish', 12)],
      recentAlerts: [],
    })
    expect(proposals).toHaveLength(0)
  })

  it('requires enough supporting candidates within the window', () => {
    const proposals = evaluateTriggers({
      now: NOW,
      composites: [mkComposite(10, 2.3, 0)],
      recentCandidates: [
        mkCandidate(1, 10, 'bullish', 3),
        mkCandidate(2, 10, 'bullish', 30), // outside 24h
      ],
      recentAlerts: [],
    })
    expect(proposals).toHaveLength(0)
  })

  it('skips when an alert fired within the cooldown for the same direction', () => {
    const proposals = evaluateTriggers({
      now: NOW,
      composites: [mkComposite(10, 2.3, 0)],
      recentCandidates: [mkCandidate(1, 10, 'bullish', 3), mkCandidate(2, 10, 'bullish', 12)],
      recentAlerts: [{ tickerId: 10, direction: 'long', firedAt: new Date(NOW.getTime() - 20 * HOUR) }],
    })
    expect(proposals).toHaveLength(0)
  })

  it('allows opposite-direction alert even during cooldown of the other side', () => {
    const proposals = evaluateTriggers({
      now: NOW,
      composites: [mkComposite(10, 0, 2.3)],
      recentCandidates: [mkCandidate(1, 10, 'bearish', 3), mkCandidate(2, 10, 'bearish', 6)],
      recentAlerts: [{ tickerId: 10, direction: 'long', firedAt: new Date(NOW.getTime() - 5 * HOUR) }],
    })
    expect(proposals).toHaveLength(1)
    expect(proposals[0].direction).toBe('short')
  })

  it('only counts sentiment-aligned candidates as support', () => {
    const proposals = evaluateTriggers({
      now: NOW,
      composites: [mkComposite(10, 2.3, 0)],
      recentCandidates: [
        mkCandidate(1, 10, 'bullish', 3),
        mkCandidate(2, 10, 'bearish', 6),
        mkCandidate(3, 10, 'neutral', 10),
      ],
      recentAlerts: [],
    })
    expect(proposals).toHaveLength(0)
  })
})
