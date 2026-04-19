import { TRPCError, type TRPCRouterRecord } from '@trpc/server'
import { z } from 'zod'
import { prisma } from '#/server/db'
import { backfillAll, backfillTicker } from '#/lib/ingest/prices/backfill'
import {
  type CoverageStatus,
  deriveCoverageStatus,
} from '#/lib/ingest/prices/coverage'
import { publicProcedure } from '../init'

const BENCHMARK_SYMBOL = 'XLE'

export interface CoverageRow {
  tickerId: number
  symbol: string
  name: string
  segment: string
  active: boolean
  rowCount: number
  firstDate: Date | null
  lastDate: Date | null
  lastCloseAgeDays: number | null
  status: CoverageStatus
}

async function loadCoverage(): Promise<CoverageRow[]> {
  const tickers = await prisma.ticker.findMany({
    orderBy: [{ segment: 'asc' }, { symbol: 'asc' }],
  })
  const stats = await prisma.priceDaily.groupBy({
    by: ['tickerId'],
    _count: { _all: true },
    _min: { date: true },
    _max: { date: true },
  })
  const statsById = new Map(stats.map((s) => [s.tickerId, s]))
  const now = new Date()

  return tickers.map<CoverageRow>((t) => {
    const s = statsById.get(t.id)
    const rowCount = s?._count._all ?? 0
    const firstDate = s?._min.date ?? null
    const lastDate = s?._max.date ?? null
    const { status, ageDays } = deriveCoverageStatus({ rowCount, lastDate, now })
    return {
      tickerId: t.id,
      symbol: t.symbol,
      name: t.name,
      segment: t.segment,
      active: t.active,
      rowCount,
      firstDate,
      lastDate,
      lastCloseAgeDays: ageDays,
      status,
    }
  })
}

export const priceRouter = {
  coverage: publicProcedure.query<CoverageRow[]>(() => loadCoverage()),

  series: publicProcedure
    .input(
      z.object({
        symbol: z.string().min(1).max(20),
        from: z.date().optional(),
        to: z.date().optional(),
        withBenchmark: z.boolean().default(false),
      }),
    )
    .query(async ({ input }) => {
      const ticker = await prisma.ticker.findUnique({
        where: { symbol: input.symbol },
        select: { id: true, symbol: true, name: true, segment: true },
      })
      if (!ticker) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Unknown ticker: ${input.symbol}`,
        })
      }

      const rows = await prisma.priceDaily.findMany({
        where: {
          tickerId: ticker.id,
          ...(input.from || input.to
            ? { date: { gte: input.from, lte: input.to } }
            : {}),
        },
        orderBy: { date: 'asc' },
        select: {
          date: true,
          open: true,
          high: true,
          low: true,
          close: true,
          adjClose: true,
          volume: true,
        },
      })

      const bars = rows.map((r) => ({
        date: r.date,
        open: r.open,
        high: r.high,
        low: r.low,
        close: r.close,
        adjClose: r.adjClose,
        volume: r.volume.toString(),
      }))

      let benchmark: { date: Date; close: number; adjClose: number }[] | null = null
      if (input.withBenchmark && ticker.symbol !== BENCHMARK_SYMBOL) {
        const benchTicker = await prisma.ticker.findUnique({
          where: { symbol: BENCHMARK_SYMBOL },
          select: { id: true },
        })
        if (benchTicker) {
          const benchRows = await prisma.priceDaily.findMany({
            where: {
              tickerId: benchTicker.id,
              ...(input.from || input.to
                ? { date: { gte: input.from, lte: input.to } }
                : {}),
            },
            orderBy: { date: 'asc' },
            select: { date: true, close: true, adjClose: true },
          })
          benchmark = benchRows
        }
      }

      return { ticker, bars, benchmark, benchmarkSymbol: BENCHMARK_SYMBOL }
    }),

  // TODO(auth): Guard with adminProcedure once auth lands.
  runBackfill: publicProcedure
    .input(z.object({ symbol: z.string().min(1).max(20).optional() }))
    .mutation(async ({ input }) => {
      if (input.symbol) {
        const ticker = await prisma.ticker.findUnique({
          where: { symbol: input.symbol },
          select: { id: true },
        })
        if (!ticker) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: `Unknown ticker: ${input.symbol}`,
          })
        }
        const result = await backfillTicker(ticker.id)
        return { results: [result] }
      }
      const results = await backfillAll()
      return { results }
    }),
} satisfies TRPCRouterRecord
