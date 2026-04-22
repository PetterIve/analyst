import type { PrismaClient } from '#/generated/prisma/client'
import { parseTickerReturns, tickerStatsInClass } from '#/features/event-catalog'

type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0]

export interface ComparableStats {
  expectedReturn5d: number
  hitRate: number
  nComparables: number
}

/**
 * Look up historical 5-day returns for (eventClass × symbol) from T08's
 * event-instance catalog.
 *
 * Falls back to zeroed stats when the class is unknown or has no instances
 * covering this ticker — the alert can still fire, but the composer knows to
 * present "no comparables" language.
 */
export async function comparableStatsFor(
  tx: Tx,
  eventClassId: number | null,
  symbol: string,
): Promise<ComparableStats> {
  if (eventClassId == null) return emptyStats()
  const instances = await tx.eventInstance.findMany({
    where: { eventClassId },
    select: { tickerReturns: true },
  })
  if (instances.length === 0) return emptyStats()
  const normalised = instances.map((row) => ({
    tickerReturns: parseTickerReturns(row.tickerReturns),
  }))
  const stats = tickerStatsInClass(normalised, symbol)
  if (!stats.d5) return emptyStats()
  return {
    expectedReturn5d: stats.d5.mean,
    hitRate: stats.d5.hitRate,
    nComparables: stats.d5.count,
  }
}

function emptyStats(): ComparableStats {
  return { expectedReturn5d: 0, hitRate: 0, nComparables: 0 }
}
