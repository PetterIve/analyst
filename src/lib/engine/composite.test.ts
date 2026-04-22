import { describe, expect, it } from 'vitest'
import { computeCompositeScores } from './composite'
import type { FactorDef, FactorStateRow } from './types'

const factors: FactorDef[] = [
  { id: 1, slug: 'vlcc_rate_momentum', rangeMin: -2, rangeMax: 2, defaultValue: 0, weight: 1.5, decayHalfLifeDays: 5 },
  { id: 2, slug: 'red_sea_exposure', rangeMin: 0, rangeMax: 1, defaultValue: 0.5, weight: 1, decayHalfLifeDays: null },
  { id: 3, slug: 'opec_supply_bias', rangeMin: -2, rangeMax: 2, defaultValue: 0, weight: 1, decayHalfLifeDays: 10 },
]

describe('computeCompositeScores', () => {
  it('sums positive contributions into longScore', () => {
    const states: FactorStateRow[] = [
      { tickerId: 10, factorId: 1, value: 1.0, updatedAt: new Date() },
      { tickerId: 10, factorId: 2, value: 0.8, updatedAt: new Date() },
    ]
    const [s] = computeCompositeScores([{ id: 10, symbol: 'FRO' }], factors, states)
    expect(s.longScore).toBeCloseTo(1.5 + 0.8)
    expect(s.shortScore).toBe(0)
  })

  it('sums negative contributions into shortScore as magnitude', () => {
    const states: FactorStateRow[] = [
      { tickerId: 10, factorId: 1, value: -1.2, updatedAt: new Date() },
      { tickerId: 10, factorId: 3, value: -0.5, updatedAt: new Date() },
    ]
    const [s] = computeCompositeScores([{ id: 10, symbol: 'FRO' }], factors, states)
    expect(s.longScore).toBe(0)
    expect(s.shortScore).toBeCloseTo(1.5 * 1.2 + 1 * 0.5)
  })

  it('orders contributions by absolute magnitude', () => {
    const states: FactorStateRow[] = [
      { tickerId: 10, factorId: 1, value: 0.2, updatedAt: new Date() },
      { tickerId: 10, factorId: 2, value: 0.9, updatedAt: new Date() },
      { tickerId: 10, factorId: 3, value: -1.5, updatedAt: new Date() },
    ]
    const [s] = computeCompositeScores([{ id: 10, symbol: 'FRO' }], factors, states)
    expect(s.contributions[0].factorSlug).toBe('opec_supply_bias')
    expect(s.contributions[1].factorSlug).toBe('red_sea_exposure')
  })

  it('emits a zero row for a ticker with no state', () => {
    const [s] = computeCompositeScores([{ id: 11, symbol: 'DHT' }], factors, [])
    expect(s.longScore).toBe(0)
    expect(s.shortScore).toBe(0)
    expect(s.contributions).toHaveLength(0)
  })
})
