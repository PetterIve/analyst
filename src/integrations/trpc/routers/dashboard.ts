import type { TRPCRouterRecord } from '@trpc/server'
import { prisma } from '#/server/db'
import { publicProcedure } from '../init'
import { computeCompositeScores } from '#/lib/engine/composite'
import { decayHalfLifeForSlug } from '#/lib/engine/factor-meta'
import type { FactorDef } from '#/lib/engine/types'

/**
 * Operator dashboard state: per-ticker factor grid + composite long/short
 * scores, plus the current pending+held alert queue. Kept in one query so
 * the page renders from a single round-trip.
 */
export const dashboardRouter = {
  state: publicProcedure.query(async () => {
    const [tickerRows, factorRows, stateRows, alerts] = await Promise.all([
      prisma.ticker.findMany({
        where: { active: true },
        select: { id: true, symbol: true, exchange: true, segment: true, name: true },
        orderBy: [{ segment: 'asc' }, { symbol: 'asc' }],
      }),
      prisma.factorDefinition.findMany({
        orderBy: { slug: 'asc' },
      }),
      prisma.factorState.findMany(),
      prisma.alert.findMany({
        where: { state: { in: ['pending', 'held'] } },
        include: { ticker: { select: { symbol: true } } },
        orderBy: { firedAt: 'desc' },
        take: 50,
      }),
    ])

    const factors: FactorDef[] = factorRows.map((f) => ({
      id: f.id,
      slug: f.slug,
      rangeMin: f.rangeMin,
      rangeMax: f.rangeMax,
      defaultValue: f.defaultValue,
      weight: f.weight,
      decayHalfLifeDays: decayHalfLifeForSlug(f.slug),
    }))
    const composites = computeCompositeScores(tickerRows, factors, stateRows)

    const stateByTicker = new Map<number, Array<{ factorId: number; value: number; updatedAt: Date }>>()
    for (const s of stateRows) {
      const list = stateByTicker.get(s.tickerId) ?? []
      list.push({ factorId: s.factorId, value: s.value, updatedAt: s.updatedAt })
      stateByTicker.set(s.tickerId, list)
    }

    const tickers = tickerRows.map((t) => {
      const rows = stateByTicker.get(t.id) ?? []
      const byFactor = new Map(rows.map((r) => [r.factorId, r] as const))
      const lastUpdate = rows
        .map((r) => r.updatedAt.getTime())
        .reduce((max, v) => (v > max ? v : max), 0)
      const composite = composites.find((c) => c.tickerId === t.id)
      return {
        id: t.id,
        symbol: t.symbol,
        exchange: t.exchange,
        segment: t.segment,
        name: t.name,
        longScore: composite?.longScore ?? 0,
        shortScore: composite?.shortScore ?? 0,
        lastUpdatedAt: lastUpdate === 0 ? null : new Date(lastUpdate),
        factors: factors.map((f) => {
          const row = byFactor.get(f.id)
          const value = row?.value ?? f.defaultValue
          return {
            slug: f.slug,
            value,
            rangeMin: f.rangeMin,
            rangeMax: f.rangeMax,
            weight: f.weight,
            isDefault: !row,
            updatedAt: row?.updatedAt ?? null,
          }
        }),
      }
    })

    return {
      factors: factors.map((f) => ({
        slug: f.slug,
        rangeMin: f.rangeMin,
        rangeMax: f.rangeMax,
        weight: f.weight,
        decayHalfLifeDays: f.decayHalfLifeDays,
      })),
      tickers,
      alertQueue: alerts.map((a) => ({
        id: a.id,
        symbol: a.ticker.symbol,
        direction: a.direction,
        state: a.state,
        firedAt: a.firedAt,
        deliverAt: a.deliverAt,
        compositeScoreAtFire: a.compositeScoreAtFire,
        entryPrice: a.entryPrice,
      })),
    }
  }),
} satisfies TRPCRouterRecord
