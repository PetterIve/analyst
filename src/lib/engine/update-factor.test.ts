import { describe, expect, it } from 'vitest'
import { computeFactorUpdate } from './update-factor'
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

describe('computeFactorUpdate', () => {
  it('adds delta within range', () => {
    const m = computeFactorUpdate(10, momentum, 0.5, 0.3, 'news')
    expect(m.newValue).toBeCloseTo(0.8)
    expect(m.delta).toBeCloseTo(0.3)
  })

  it('clamps at max and reports truncated delta', () => {
    const m = computeFactorUpdate(10, momentum, 1.8, 1.0, 'news')
    expect(m.newValue).toBe(2)
    expect(m.delta).toBeCloseTo(0.2)
  })

  it('clamps at min and reports truncated delta', () => {
    const m = computeFactorUpdate(10, structural, 0.1, -0.5, 'news')
    expect(m.newValue).toBe(0)
    expect(m.delta).toBeCloseTo(-0.1)
  })

  it('is a no-op when already clamped and pushed further', () => {
    const m = computeFactorUpdate(10, momentum, 2, 0.5, 'news')
    expect(m.newValue).toBe(2)
    expect(m.delta).toBe(0)
  })
})
