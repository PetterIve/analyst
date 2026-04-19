import type { PrismaClient } from '#/generated/prisma/client'

export interface TickerReturns {
  d1: number | null
  d5: number | null
  d20: number | null
}

export type TickerReturnsMap = Record<string, TickerReturns>

const FORWARD_DAYS = 20
const ANCHOR_PLUS_FORWARD = FORWARD_DAYS + 1 // anchor row + 20 forward trading days

/**
 * Pure horizon arithmetic over an ordered series of `adjClose` values where
 * index 0 is the anchor (first trading day at-or-after the event) and index
 * `n` is the n-th forward trading day. Splitting this from the DB-querying
 * wrapper keeps the math unit-testable without a Prisma client.
 *
 * Returns `null` for any horizon whose forward bar is missing, and `null`
 * for all horizons when the anchor is absent or zero (zero would produce
 * Infinity / NaN).
 */
export function returnsFromAdjCloses(
  adjCloses: ReadonlyArray<number>,
): TickerReturns {
  const anchor = adjCloses[0]
  if (anchor === undefined || anchor === 0) {
    return { d1: null, d5: null, d20: null }
  }
  const ret = (offset: number): number | null => {
    const value = adjCloses[offset]
    return value === undefined ? null : value / anchor - 1
  }
  return { d1: ret(1), d5: ret(5), d20: ret(20) }
}

/**
 * Compute 1d / 5d / 20d trade-day-aligned returns for an event date across the
 * given tickers, using `adjClose` (total return — handles dividends/splits).
 *
 * The "anchor" is the first trading day at-or-after `occurredAt`, so weekend
 * or holiday event dates are handled naturally. Returns are `close[t+N] /
 * close[t] - 1`. If forward data is missing (recent event near the price-data
 * frontier, or tickers without coverage yet) the slot is `null` rather than
 * computed against incomplete data.
 */
export async function computeEventReturns(
  prisma: PrismaClient,
  occurredAt: Date,
  symbols: ReadonlyArray<string>,
): Promise<TickerReturnsMap> {
  if (symbols.length === 0) return {}

  const tickers = await prisma.ticker.findMany({
    where: { symbol: { in: [...symbols] } },
    select: { id: true, symbol: true },
  })

  const result: TickerReturnsMap = {}
  for (const ticker of tickers) {
    const rows = await prisma.priceDaily.findMany({
      where: { tickerId: ticker.id, date: { gte: occurredAt } },
      orderBy: { date: 'asc' },
      take: ANCHOR_PLUS_FORWARD,
      select: { adjClose: true },
    })

    result[ticker.symbol] = returnsFromAdjCloses(rows.map((r) => r.adjClose))
  }

  // Symbols with no Ticker row at all (typo in seed) get explicit nulls so the
  // caller can surface "unknown ticker" rather than silently dropping it.
  for (const symbol of symbols) {
    if (!(symbol in result)) {
      result[symbol] = { d1: null, d5: null, d20: null }
    }
  }

  return result
}

function parseAffected(raw: unknown): ReadonlyArray<string> {
  if (!Array.isArray(raw)) return []
  return raw.filter((v): v is string => typeof v === 'string')
}

/**
 * Recompute and persist `ticker_returns` for every existing event instance,
 * optionally filtered by class. Idempotent — overwrites the JSON column with
 * a fresh compute against current `prices_daily` rows.
 *
 * Affected symbols come from each row's own `affected_symbols` JSON, so the
 * operator can edit instances via the admin UI without code changes.
 */
export async function recomputeAllEventReturns(
  prisma: PrismaClient,
  options: { eventClassId?: number } = {},
): Promise<{ updated: number; skipped: number }> {
  const instances = await prisma.eventInstance.findMany({
    where: options.eventClassId ? { eventClassId: options.eventClassId } : undefined,
    select: { id: true, occurredAt: true, affectedSymbols: true },
  })

  let updated = 0
  let skipped = 0
  for (const instance of instances) {
    const symbols = parseAffected(instance.affectedSymbols)
    if (symbols.length === 0) {
      skipped++
      continue
    }
    const returns = await computeEventReturns(prisma, instance.occurredAt, symbols)
    await prisma.eventInstance.update({
      where: { id: instance.id },
      // Prisma's InputJsonValue rejects typed Records; the runtime shape is
      // a plain string-keyed object so casting through unknown is safe.
      data: { tickerReturns: returns as unknown as object },
    })
    updated++
  }
  return { updated, skipped }
}
