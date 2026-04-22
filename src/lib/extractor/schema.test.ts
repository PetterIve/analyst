import { describe, expect, it } from 'vitest'
import { eventCandidateSchema } from './schema'

const valid = {
  eventClassSlug: 'red_sea_attack',
  affectedTickers: [
    { symbol: 'STNG', confidence: 0.8 },
    { symbol: 'TRMD', confidence: 0.6 },
  ],
  sentiment: 'bullish' as const,
  proposedFactorDeltas: [
    {
      factorSlug: 'clean_product_rate_momentum',
      delta: 0.9,
      reason: 'Named multiple product tanker rerouting',
    },
  ],
  overallConfidence: 0.85,
  excerpt: 'Houthi strike hits another tanker in the Red Sea',
}

describe('eventCandidateSchema', () => {
  it('accepts a canonical candidate', () => {
    const out = eventCandidateSchema.parse(valid)
    expect(out.eventClassSlug).toBe('red_sea_attack')
    expect(out.affectedTickers).toHaveLength(2)
  })

  it('accepts null eventClassSlug for "not tanker-relevant"', () => {
    const out = eventCandidateSchema.parse({
      ...valid,
      eventClassSlug: null,
      affectedTickers: [],
      proposedFactorDeltas: [],
      sentiment: 'neutral',
      excerpt: 'Apple announces new iPhone',
    })
    expect(out.eventClassSlug).toBeNull()
  })

  it('accepts an empty proposedFactorDeltas array (use defaults)', () => {
    const out = eventCandidateSchema.parse({ ...valid, proposedFactorDeltas: [] })
    expect(out.proposedFactorDeltas).toEqual([])
  })

  it('rejects confidence above 1', () => {
    expect(() =>
      eventCandidateSchema.parse({ ...valid, overallConfidence: 1.1 }),
    ).toThrow()
  })

  it('rejects factor delta outside [-2, 2]', () => {
    expect(() =>
      eventCandidateSchema.parse({
        ...valid,
        proposedFactorDeltas: [
          { factorSlug: 'x', delta: 3, reason: 'too big' },
        ],
      }),
    ).toThrow()
  })

  it('rejects invalid sentiment enum', () => {
    expect(() =>
      eventCandidateSchema.parse({ ...valid, sentiment: 'manic' }),
    ).toThrow()
  })

  it('rejects per-ticker confidence below 0', () => {
    expect(() =>
      eventCandidateSchema.parse({
        ...valid,
        affectedTickers: [{ symbol: 'FRO', confidence: -0.1 }],
      }),
    ).toThrow()
  })
})
