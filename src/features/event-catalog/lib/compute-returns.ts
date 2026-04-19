import type { PrismaClient } from '#/generated/prisma/client'

export interface TickerReturns {
  d1: number | null
  d5: number | null
  d20: number | null
}

export type TickerReturnsMap = Record<string, TickerReturns>

const FORWARD_DAYS = 20
const ANCHOR_PLUS_FORWARD = FORWARD_DAYS + 1 // anchor row + 20 forward trading days

// Calendar-day window passed to the price query. Must comfortably cover
// `ANCHOR_PLUS_FORWARD` trading days (~30 with weekends/holidays); 60 leaves
// headroom for long holiday stretches (Christmas–New Year, Easter clusters).
// Trimmed back to `ANCHOR_PLUS_FORWARD` per ticker after the JS-side group.
const FORWARD_CALENDAR_DAYS = 60

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
  // Symbols with no Ticker row at all (typo in seed) get explicit nulls so the
  // caller can surface "unknown ticker" rather than silently dropping it.
  for (const symbol of symbols) {
    result[symbol] = { d1: null, d5: null, d20: null }
  }

  if (tickers.length === 0) return result

  const horizonEnd = new Date(occurredAt)
  horizonEnd.setUTCDate(horizonEnd.getUTCDate() + FORWARD_CALENDAR_DAYS)

  // One query for all tickers in the date range — avoids the N×M round-trip
  // explosion `recomputeAllEventReturns` would otherwise produce (instances ×
  // tickers). Group + slice per ticker happens in JS.
  const rows = await prisma.priceDaily.findMany({
    where: {
      tickerId: { in: tickers.map((t) => t.id) },
      date: { gte: occurredAt, lte: horizonEnd },
    },
    orderBy: [{ tickerId: 'asc' }, { date: 'asc' }],
    select: { tickerId: true, adjClose: true },
  })

  const closesByTicker = new Map<number, number[]>()
  for (const row of rows) {
    const arr = closesByTicker.get(row.tickerId) ?? []
    // Trim to the trading-day window we actually need; surplus rows from the
    // wider calendar query are dropped here so `returnsFromAdjCloses` reads
    // the correct offsets.
    if (arr.length < ANCHOR_PLUS_FORWARD) arr.push(row.adjClose)
    closesByTicker.set(row.tickerId, arr)
  }

  for (const ticker of tickers) {
    const closes = closesByTicker.get(ticker.id) ?? []
    result[ticker.symbol] = returnsFromAdjCloses(closes)
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
