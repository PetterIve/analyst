import type { CompositeScore, FactorDef, FactorStateRow } from './types'

export interface TickerRef {
  id: number
  symbol: string
}

/**
 * Compute per-ticker composite scores.
 *
 * `longScore` sums positive contributions (value × weight > 0); `shortScore`
 * sums the magnitude of negative contributions. A factor near zero contributes
 * nothing, so sign changes as new signals arrive rather than being sticky.
 */
export function computeCompositeScores(
  tickers: ReadonlyArray<TickerRef>,
  factors: ReadonlyArray<FactorDef>,
  states: ReadonlyArray<FactorStateRow>,
): CompositeScore[] {
  const factorById = new Map(factors.map((f) => [f.id, f] as const))
  const stateByTicker = new Map<number, FactorStateRow[]>()
  for (const s of states) {
    const list = stateByTicker.get(s.tickerId) ?? []
    list.push(s)
    stateByTicker.set(s.tickerId, list)
  }

  return tickers.map((ticker) => {
    const rows = stateByTicker.get(ticker.id) ?? []
    let longScore = 0
    let shortScore = 0
    const contributions: CompositeScore['contributions'] = []

    for (const row of rows) {
      const factor = factorById.get(row.factorId)
      if (!factor) continue
      const contribution = row.value * factor.weight
      contributions.push({
        factorSlug: factor.slug,
        value: row.value,
        weight: factor.weight,
        contribution,
      })
      if (contribution > 0) longScore += contribution
      else if (contribution < 0) shortScore += -contribution
    }

    contributions.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))

    return {
      tickerId: ticker.id,
      symbol: ticker.symbol,
      longScore,
      shortScore,
      contributions,
    }
  })
}
