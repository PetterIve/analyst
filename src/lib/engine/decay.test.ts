import { describe, expect, it } from 'vitest'
import { decayFactorValue } from './decay'
import type { FactorDef } from './types'

const momentum: FactorDef = {
  id: 1,
  slug: 'vlcc_rate_momentum',
  rangeMin: -2,
  rangeMax: 2,
  defaultValue: 0,
  weight: 1.5,
  decayHalfLifeDays: 5,
}

const structural: FactorDef = {
  id: 2,
  slug: 'red_sea_exposure',
  rangeMin: 0,
  rangeMax: 1,
  defaultValue: 0.5,
  weight: 1,
  decayHalfLifeDays: null,
}

const DAY_MS = 1000 * 60 * 60 * 24

describe('decayFactorValue', () => {
  it('leaves structural factors unchanged', () => {
    expect(decayFactorValue(structural, 0.8, 100 * DAY_MS)).toBe(0.8)
  })

  it('halves momentum value after one half-life', () => {
    expect(decayFactorValue(momentum, 1.0, 5 * DAY_MS)).toBeCloseTo(0.5)
  })

  it('quarters momentum value after two half-lives', () => {
    expect(decayFactorValue(momentum, 1.0, 10 * DAY_MS)).toBeCloseTo(0.25)
  })

  it('snaps tiny residuals to 0 to avoid history spam', () => {
    expect(decayFactorValue(momentum, 1.0, 200 * DAY_MS)).toBe(0)
  })

  it('is a no-op for non-positive elapsed time', () => {
    expect(decayFactorValue(momentum, 1.0, 0)).toBe(1.0)
    expect(decayFactorValue(momentum, 1.0, -1000)).toBe(1.0)
  })
})
