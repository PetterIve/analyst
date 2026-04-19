import { prisma } from '#/server/db'
import { logger } from '#/lib/logger.server'
import type { PriceProvider, DailyBar } from './provider'
import { yahooPriceProvider } from './yahoo-provider'

const DEFAULT_YEARS_BACK = 5
const UPSERT_CHUNK = 500

export interface BackfillResult {
  symbol: string
  tickerId: number
  rowsInserted: number
  from: Date
  to: Date
  skipped: boolean
  error?: string
}

export interface BackfillOptions {
  provider?: PriceProvider
  yearsBack?: number
  now?: () => Date
}

export async function backfillTicker(
  tickerId: number,
  options: BackfillOptions = {},
): Promise<BackfillResult> {
  const provider = options.provider ?? yahooPriceProvider
  const yearsBack = options.yearsBack ?? DEFAULT_YEARS_BACK
  const now = options.now?.() ?? new Date()

  const ticker = await prisma.ticker.findUniqueOrThrow({
    where: { id: tickerId },
    select: { id: true, symbol: true },
  })

  const latest = await prisma.priceDaily.findFirst({
    where: { tickerId },
    orderBy: { date: 'desc' },
    select: { date: true },
  })

  const { from, to, skipped } = computeBackfillRange({
    latestDate: latest?.date ?? null,
    now,
    yearsBack,
  })

  if (skipped) {
    return {
      symbol: ticker.symbol,
      tickerId,
      rowsInserted: 0,
      from,
      to,
      skipped: true,
    }
  }

  let bars: DailyBar[]
  try {
    bars = await fetchWithRetry(provider, ticker.symbol, from, to)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error(
      { tickerId, symbol: ticker.symbol, err: msg },
      'price backfill failed',
    )
    return {
      symbol: ticker.symbol,
      tickerId,
      rowsInserted: 0,
      from,
      to,
      skipped: false,
      error: msg,
    }
  }

  let rowsInserted = 0
  for (const chunk of chunked(bars, UPSERT_CHUNK)) {
    const res = await prisma.priceDaily.createMany({
      data: chunk.map((bar) => ({
        tickerId,
        date: bar.date,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        adjClose: bar.adjClose,
        volume: bar.volume,
      })),
      skipDuplicates: true,
    })
    rowsInserted += res.count
  }

  logger.info(
    { tickerId, symbol: ticker.symbol, rowsInserted, fetched: bars.length },
    'price backfill done',
  )

  return {
    symbol: ticker.symbol,
    tickerId,
    rowsInserted,
    from,
    to,
    skipped: false,
  }
}

export async function backfillAll(
  options: BackfillOptions = {},
): Promise<BackfillResult[]> {
  const tickers = await prisma.ticker.findMany({
    where: { active: true },
    orderBy: { symbol: 'asc' },
    select: { id: true },
  })
  const results: BackfillResult[] = []
  for (const t of tickers) {
    const r = await backfillTicker(t.id, options)
    results.push(r)
  }
  return results
}

export interface ComputeBackfillRangeInput {
  latestDate: Date | null
  now: Date
  yearsBack: number
}

export interface ComputeBackfillRangeResult {
  from: Date
  to: Date
  skipped: boolean
}

export function computeBackfillRange({
  latestDate,
  now,
  yearsBack,
}: ComputeBackfillRangeInput): ComputeBackfillRangeResult {
  const from = latestDate ? addDays(latestDate, 1) : subtractYears(now, yearsBack)
  const to = addDays(startOfUtcDay(now), 1)
  return { from, to, skipped: from >= to }
}

async function fetchWithRetry(
  provider: PriceProvider,
  symbol: string,
  from: Date,
  to: Date,
): Promise<DailyBar[]> {
  try {
    return await provider.fetchDaily(symbol, from, to)
  } catch (err) {
    logger.warn(
      { symbol, err: err instanceof Error ? err.message : String(err) },
      'price fetch failed — retrying once',
    )
    await sleep(1500)
    return provider.fetchDaily(symbol, from, to)
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms))
}

function* chunked<T>(arr: T[], size: number): Generator<T[]> {
  for (let i = 0; i < arr.length; i += size) yield arr.slice(i, i + size)
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

function addDays(d: Date, n: number): Date {
  const copy = new Date(d)
  copy.setUTCDate(copy.getUTCDate() + n)
  return copy
}

function subtractYears(d: Date, n: number): Date {
  const copy = startOfUtcDay(d)
  copy.setUTCFullYear(copy.getUTCFullYear() - n)
  return copy
}
