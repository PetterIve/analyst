import { describe, expect, it } from 'vitest'
import { returnsFromAdjCloses } from './compute-returns'

describe('returnsFromAdjCloses', () => {
  it('returns all nulls when no anchor is present', () => {
    expect(returnsFromAdjCloses([])).toEqual({ d1: null, d5: null, d20: null })
  })

  it('returns all nulls when the anchor is zero (avoid divide-by-zero)', () => {
    const cases = Array.from({ length: 21 }, (_, i) => (i === 0 ? 0 : 100))
    expect(returnsFromAdjCloses(cases)).toEqual({ d1: null, d5: null, d20: null })
  })

  it('computes a single horizon when only the anchor + d1 row exist', () => {
    const result = returnsFromAdjCloses([100, 101])
    expect(result.d1).toBeCloseTo(0.01)
    expect(result.d5).toBeNull()
    expect(result.d20).toBeNull()
  })

  it('reads forward returns from indices 1, 5 and 20 — not 1, 5, 20 days of calendar offset', () => {
    // Index matters: callers must pass *trading-day-aligned* anchor + 20
    // forward trading days. The function does not skip weekends — it just
    // indexes positionally. This test pins that contract.
    const series = [
      100, // anchor (index 0)
      101, // index 1 → d1
      102, // index 2
      103, // index 3
      104, // index 4
      105, // index 5 → d5
      106, // index 6
      107, // index 7
      108, // index 8
      109, // index 9
      110, // index 10
      111, // index 11
      112, // index 12
      113, // index 13
      114, // index 14
      115, // index 15
      116, // index 16
      117, // index 17
      118, // index 18
      119, // index 19
      120, // index 20 → d20
    ]
    const result = returnsFromAdjCloses(series)
    expect(result.d1).toBeCloseTo(0.01)
    expect(result.d5).toBeCloseTo(0.05)
    expect(result.d20).toBeCloseTo(0.2)
  })

  it('handles negative returns', () => {
    const series = [100, 99, 98, 97, 96, 95]
    const result = returnsFromAdjCloses(series)
    expect(result.d1).toBeCloseTo(-0.01)
    expect(result.d5).toBeCloseTo(-0.05)
    expect(result.d20).toBeNull()
  })

  it('uses the supplied anchor unchanged — does not normalize to 1.0', () => {
    // Regression guard: a previous draft normalized to 1.0 first, which
    // accumulated float error on small series. Pin the literal arithmetic.
    const result = returnsFromAdjCloses([42.5, 43.35])
    expect(result.d1).toBeCloseTo((43.35 - 42.5) / 42.5)
  })

  it('ignores extra rows beyond d20', () => {
    const series = Array.from({ length: 50 }, (_, i) => 100 + i) // anchor=100, +50 trailing
    const result = returnsFromAdjCloses(series)
    expect(result.d20).toBeCloseTo(0.2)
    // Sanity: d20 came from index 20 (=120), not from later rows.
  })
})
