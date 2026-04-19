import type { TickerReturns, TickerReturnsMap } from './compute-returns'

export interface ReturnStats {
  count: number
  mean: number
  median: number
  stddev: number
  hitRate: number // share of observations with return > 0
}

export interface EventClassStats {
  instanceCount: number
  observationCount: number // total (instance × ticker) data points used
  d1: ReturnStats | null
  d5: ReturnStats | null
  d20: ReturnStats | null
  /** Per-ticker breakdown — stats across that ticker's appearances in this class. */
  perTicker: Record<string, { count: number; d1: ReturnStats | null; d5: ReturnStats | null; d20: ReturnStats | null }>
}

const LOW_SAMPLE_THRESHOLD = 5
export const isLowSample = (count: number): boolean => count < LOW_SAMPLE_THRESHOLD

function computeStats(values: ReadonlyArray<number>): ReturnStats | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const sum = sorted.reduce((acc, v) => acc + v, 0)
  const mean = sum / sorted.length
  const variance =
    sorted.reduce((acc, v) => acc + (v - mean) ** 2, 0) / sorted.length
  const stddev = Math.sqrt(variance)
  const median =
    sorted.length % 2 === 1
      ? sorted[(sorted.length - 1) / 2]
      : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
  const hits = sorted.filter((v) => v > 0).length
  return {
    count: sorted.length,
    mean,
    median,
    stddev,
    hitRate: hits / sorted.length,
  }
}

/**
 * `tickerReturns` JSON in the DB is `unknown`. This narrows it back to the
 * shape `compute-returns.ts` writes, ignoring any malformed entries.
 */
export function parseTickerReturns(raw: unknown): TickerReturnsMap {
  if (!raw || typeof raw !== 'object') return {}
  const out: TickerReturnsMap = {}
  for (const [symbol, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') continue
    const v = value as Record<string, unknown>
    const num = (k: string): number | null =>
      typeof v[k] === 'number' && Number.isFinite(v[k]) ? (v[k] as number) : null
    out[symbol] = { d1: num('d1'), d5: num('d5'), d20: num('d20') }
  }
  return out
}

interface InstanceWithReturns {
  tickerReturns: TickerReturnsMap
}

/**
 * Aggregate stats across every (instance, ticker) data point in the class.
 * `null` slots (missing forward data) are excluded from the count so a stale
 * recent event doesn't drag stats with zeros.
 */
export function eventClassStats(
  instances: ReadonlyArray<InstanceWithReturns>,
): EventClassStats {
  const pool = { d1: [] as number[], d5: [] as number[], d20: [] as number[] }
  const perTicker: Record<string, { d1: number[]; d5: number[]; d20: number[] }> = {}
  let observationCount = 0

  for (const instance of instances) {
    for (const [symbol, returns] of Object.entries(instance.tickerReturns)) {
      const t = (perTicker[symbol] ??= { d1: [], d5: [], d20: [] })
      let counted = false
      for (const horizon of ['d1', 'd5', 'd20'] as const) {
        const value = returns[horizon]
        if (value === null || value === undefined) continue
        pool[horizon].push(value)
        t[horizon].push(value)
        counted = true
      }
      if (counted) observationCount++
    }
  }

  const perTickerStats: EventClassStats['perTicker'] = {}
  for (const [symbol, vals] of Object.entries(perTicker)) {
    perTickerStats[symbol] = {
      count: Math.max(vals.d1.length, vals.d5.length, vals.d20.length),
      d1: computeStats(vals.d1),
      d5: computeStats(vals.d5),
      d20: computeStats(vals.d20),
    }
  }

  return {
    instanceCount: instances.length,
    observationCount,
    d1: computeStats(pool.d1),
    d5: computeStats(pool.d5),
    d20: computeStats(pool.d20),
    perTicker: perTickerStats,
  }
}

/** For a single ticker across multiple instances. Used by alert composer (T11). */
export function tickerStatsInClass(
  instances: ReadonlyArray<InstanceWithReturns>,
  symbol: string,
): { d1: ReturnStats | null; d5: ReturnStats | null; d20: ReturnStats | null } {
  const buckets: Record<keyof TickerReturns, number[]> = { d1: [], d5: [], d20: [] }
  for (const instance of instances) {
    const r = instance.tickerReturns[symbol]
    if (!r) continue
    for (const horizon of ['d1', 'd5', 'd20'] as const) {
      const value = r[horizon]
      if (value !== null && value !== undefined) buckets[horizon].push(value)
    }
  }
  return {
    d1: computeStats(buckets.d1),
    d5: computeStats(buckets.d5),
    d20: computeStats(buckets.d20),
  }
}
