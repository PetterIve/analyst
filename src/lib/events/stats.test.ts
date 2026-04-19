import { describe, expect, it } from 'vitest'
import type { TickerReturnsMap } from './compute-returns'
import {
  eventClassStats,
  isLowSample,
  parseTickerReturns,
  tickerStatsInClass,
} from './stats'

describe('parseTickerReturns', () => {
  it('returns empty for non-objects', () => {
    expect(parseTickerReturns(null)).toEqual({})
    expect(parseTickerReturns(undefined)).toEqual({})
    expect(parseTickerReturns(42)).toEqual({})
    expect(parseTickerReturns('foo')).toEqual({})
  })

  it('keeps numeric horizons and converts missing/non-numeric to null', () => {
    const raw = {
      FRO: { d1: 0.01, d5: 0.05, d20: 0.2 },
      DHT: { d1: 'bad', d5: 0.03 },
      BAD: 'not-an-object',
    }
    expect(parseTickerReturns(raw)).toEqual({
      FRO: { d1: 0.01, d5: 0.05, d20: 0.2 },
      DHT: { d1: null, d5: 0.03, d20: null },
    })
  })
})

describe('eventClassStats', () => {
  it('returns nulls and zero counts for empty input', () => {
    const stats = eventClassStats([])
    expect(stats.instanceCount).toBe(0)
    expect(stats.observationCount).toBe(0)
    expect(stats.d5).toBeNull()
    expect(stats.perTicker).toEqual({})
  })

  it('pools across instances and tickers, ignoring null slots', () => {
    const instances = [
      {
        tickerReturns: {
          FRO: { d1: 0.01, d5: 0.05, d20: 0.2 },
          DHT: { d1: 0.02, d5: 0.04, d20: 0.1 },
        },
      },
      {
        tickerReturns: {
          FRO: { d1: -0.01, d5: 0.03, d20: null },
          DHT: { d1: null, d5: -0.02, d20: 0.05 },
        },
      },
    ]
    const stats = eventClassStats(instances)
    expect(stats.instanceCount).toBe(2)
    expect(stats.observationCount).toBe(4)
    expect(stats.d1?.count).toBe(3)
    expect(stats.d5?.count).toBe(4)
    expect(stats.d20?.count).toBe(3)
    expect(stats.d5?.mean).toBeCloseTo((0.05 + 0.04 + 0.03 - 0.02) / 4)
    expect(stats.d5?.hitRate).toBeCloseTo(3 / 4)
  })

  it('breaks down per-ticker across instances', () => {
    const instances = [
      { tickerReturns: { FRO: { d1: 0.01, d5: 0.05, d20: null } } },
      { tickerReturns: { FRO: { d1: 0.02, d5: -0.01, d20: null } } },
    ]
    const stats = eventClassStats(instances)
    expect(stats.perTicker.FRO.d5?.count).toBe(2)
    expect(stats.perTicker.FRO.d5?.mean).toBeCloseTo((0.05 - 0.01) / 2)
    expect(stats.perTicker.FRO.d5?.hitRate).toBeCloseTo(0.5)
  })
})

describe('tickerStatsInClass', () => {
  it('aggregates only the requested symbol', () => {
    const instances: Array<{ tickerReturns: TickerReturnsMap }> = [
      { tickerReturns: { FRO: { d1: 0.01, d5: 0.05, d20: 0.1 }, DHT: { d1: 0.99, d5: 0.99, d20: 0.99 } } },
      { tickerReturns: { FRO: { d1: 0.02, d5: 0.03, d20: 0.2 } } },
    ]
    const result = tickerStatsInClass(instances, 'FRO')
    expect(result.d5?.count).toBe(2)
    expect(result.d5?.mean).toBeCloseTo(0.04)
  })

  it('returns nulls when the symbol never appears', () => {
    const instances = [{ tickerReturns: { FRO: { d1: 0.01, d5: 0.05, d20: 0.1 } } }]
    const result = tickerStatsInClass(instances, 'GHOST')
    expect(result.d1).toBeNull()
    expect(result.d5).toBeNull()
    expect(result.d20).toBeNull()
  })
})

describe('isLowSample', () => {
  it('flags counts under 5', () => {
    expect(isLowSample(0)).toBe(true)
    expect(isLowSample(4)).toBe(true)
    expect(isLowSample(5)).toBe(false)
    expect(isLowSample(50)).toBe(false)
  })
})
