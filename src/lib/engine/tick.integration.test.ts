import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '#/server/db'
import { engineTick } from './tick'

/**
 * End-to-end engine integration test. Exercises decay → apply → composite →
 * trigger → gate → alert insertion against a real Postgres. Wipes engine
 * state (factor_state, factor_state_history, alerts, alert_sources,
 * event_candidates) between cases but leaves the seeded tickers + factors +
 * event classes untouched.
 *
 * Skipped by default when DATABASE_URL isn't set so `npm test` works on
 * machines without the dev Postgres container running.
 */
const hasDb = Boolean(process.env.DATABASE_URL)
const d = hasDb ? describe : describe.skip

const TEST_SOURCE_NAME = '__engine_test_source__'

async function wipeEngineState() {
  await prisma.alertSource.deleteMany()
  await prisma.alert.deleteMany()
  await prisma.factorStateHistory.deleteMany()
  await prisma.factorState.deleteMany()
  await prisma.eventCandidate.deleteMany()
  const src = await prisma.newsSource.findFirst({ where: { name: TEST_SOURCE_NAME } })
  if (src) {
    await prisma.newsItem.deleteMany({ where: { sourceId: src.id } })
  }
}

async function ensureTestNewsSource(): Promise<number> {
  const existing = await prisma.newsSource.findFirst({ where: { name: TEST_SOURCE_NAME } })
  if (existing) return existing.id
  const created = await prisma.newsSource.create({
    data: {
      name: TEST_SOURCE_NAME,
      kind: 'rss',
      url: 'https://example.com/engine-test',
      pollIntervalSec: 900,
      active: false,
    },
    select: { id: true },
  })
  return created.id
}

async function seedCandidate(args: {
  createdAtOffsetMs?: number
  sentiment?: 'bullish' | 'bearish' | 'neutral'
  affectedSymbols: string[]
  deltas: Array<{ factorSlug: string; delta: number; reason: string }>
  overallConfidence?: number
  eventClassSlug?: string
}): Promise<number> {
  const eventClass = args.eventClassSlug
    ? await prisma.eventClass.findUnique({ where: { slug: args.eventClassSlug }, select: { id: true } })
    : null

  const sourceId = await ensureTestNewsSource()
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
  const newsItem = await prisma.newsItem.create({
    data: {
      sourceId,
      url: `https://example.com/engine-test/${suffix}`,
      title: `synthetic engine-test story ${suffix}`,
      contentHash: suffix,
    },
    select: { id: true },
  })

  const createdAt = new Date(Date.now() + (args.createdAtOffsetMs ?? 0))
  const row = await prisma.eventCandidate.create({
    data: {
      sourceKind: 'news',
      sourceRefId: newsItem.id,
      createdAt,
      eventClassId: eventClass?.id ?? null,
      overallConfidence: args.overallConfidence ?? 0.75,
      extractedJson: {
        eventClassSlug: args.eventClassSlug ?? null,
        affectedTickers: args.affectedSymbols.map((s) => ({ symbol: s, confidence: 0.8 })),
        sentiment: args.sentiment ?? 'bullish',
        proposedFactorDeltas: args.deltas,
        overallConfidence: args.overallConfidence ?? 0.75,
        excerpt: `synthetic candidate for ${args.affectedSymbols.join(', ')}`,
      },
    },
    select: { id: true },
  })
  return row.id
}

d('engineTick integration', () => {
  beforeEach(async () => {
    await wipeEngineState()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('applies a single candidate to factor_state with a history row', async () => {
    const fro = await prisma.ticker.findUnique({ where: { symbol: 'FRO' } })
    if (!fro) return

    await seedCandidate({
      affectedSymbols: ['FRO'],
      deltas: [{ factorSlug: 'vlcc_rate_momentum', delta: 1.2, reason: 'synthetic' }],
    })

    const result = await engineTick(prisma)
    expect(result.apply.applied).toBe(1)
    expect(result.apply.mutations).toBe(1)

    const factor = await prisma.factorDefinition.findUnique({ where: { slug: 'vlcc_rate_momentum' } })
    const state = await prisma.factorState.findUnique({
      where: { tickerId_factorId: { tickerId: fro.id, factorId: factor!.id } },
    })
    expect(state?.value).toBeCloseTo(1.2)

    const history = await prisma.factorStateHistory.findMany({ where: { tickerId: fro.id } })
    expect(history).toHaveLength(1)
    expect(history[0].reason).toMatch(/synthetic/)
  })

  it('does not fire an alert below the support threshold (only one candidate)', async () => {
    await seedCandidate({
      affectedSymbols: ['FRO'],
      deltas: [
        { factorSlug: 'vlcc_rate_momentum', delta: 2.0, reason: 'push above threshold solo' },
        { factorSlug: 'opec_supply_bias', delta: 2.0, reason: 'push above threshold solo' },
      ],
    })
    const result = await engineTick(prisma)
    expect(result.alertsCreated).toBe(0)
  })

  it('fires once when threshold + confirmation count are met, then respects cooldown', async () => {
    await seedCandidate({
      affectedSymbols: ['FRO'],
      deltas: [{ factorSlug: 'vlcc_rate_momentum', delta: 1.5, reason: 'push up' }],
      createdAtOffsetMs: -2 * 60 * 60 * 1000,
      overallConfidence: 0.8,
    })
    await seedCandidate({
      affectedSymbols: ['FRO'],
      deltas: [{ factorSlug: 'opec_supply_bias', delta: 1.5, reason: 'add macro push' }],
      createdAtOffsetMs: -30 * 60 * 1000,
      overallConfidence: 0.9,
    })

    // Make sure we have a price row so the entry-price fetch succeeds.
    const fro = await prisma.ticker.findUnique({ where: { symbol: 'FRO' } })
    if (!fro) return
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    await prisma.priceDaily.upsert({
      where: { tickerId_date: { tickerId: fro.id, date: today } },
      create: {
        tickerId: fro.id,
        date: today,
        open: 20,
        high: 21,
        low: 19,
        close: 20.5,
        adjClose: 20.5,
        volume: 1000000n,
      },
      update: { close: 20.5, adjClose: 20.5 },
    })

    const first = await engineTick(prisma)
    expect(first.alertsCreated).toBe(1)

    // Second tick with no new candidates: cooldown should prevent a second alert.
    const second = await engineTick(prisma)
    expect(second.alertsCreated).toBe(0)
  })
})
