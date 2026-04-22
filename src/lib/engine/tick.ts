import type { PrismaClient } from '#/generated/prisma/client'
import { logger } from '#/lib/logger.server'
import {
  applyCandidates,
  type ApplyResult,
  type UnconsumedCandidateRow,
} from './apply'
import { computeCompositeScores } from './composite'
import { comparableStatsFor } from './comparables'
import { decayFactorValue } from './decay'
import { decayHalfLifeForSlug } from './factor-meta'
import { gateAlert } from './gate'
import { latestEntryPrice } from './quote'
import {
  evaluateTriggers,
  type TriggerProposal,
  DEFAULT_TRIGGER_CONFIG,
  type RecentAlertRef,
} from './trigger'
import type {
  CandidateInput,
  CompositeScore,
  FactorDef,
  FactorStateRow,
} from './types'

type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0]

export interface EngineTickResult {
  startedAt: Date
  finishedAt: Date
  decayMutations: number
  apply: ApplyResult
  compositeCount: number
  proposalsEvaluated: number
  alertsCreated: number
  alertsHeld: number
  alertsPending: number
}

export interface EngineTickOptions {
  now?: Date
}

/**
 * End-to-end engine tick. Runs inside a single transaction so partial state
 * can't leak: either every mutation this tick lands or none of them do.
 *
 * Ordering:
 *   1. Decay momentum/macro factors toward 0 based on time since last update.
 *   2. Apply unconsumed candidates → factor state + history rows.
 *   3. Recompute per-ticker composites.
 *   4. Evaluate triggers against candidates from the last 24h.
 *   5. Insert `alert` rows; run each through the RTH gate to mark held vs pending.
 */
export async function engineTick(
  prisma: PrismaClient,
  opts: EngineTickOptions = {},
): Promise<EngineTickResult> {
  const startedAt = new Date()
  const now = opts.now ?? startedAt

  return prisma.$transaction(async (tx) => {
    const decayMutations = await runDecay(tx, now)
    const unconsumed = await fetchUnconsumedCandidates(tx)
    const apply = await applyCandidates(tx, unconsumed, now)

    const { composites, tickers } = await recomputeComposites(tx)

    // Pull the full 24h window of candidates (already-consumed included) so
    // newly-applied ones plus prior ticks' context all count toward
    // confirmation.
    const windowStart = new Date(now.getTime() - DEFAULT_TRIGGER_CONFIG.supportingWindowMs)
    const recentCandidates = await fetchRecentCandidates(tx, windowStart)
    const cooldownStart = new Date(now.getTime() - DEFAULT_TRIGGER_CONFIG.cooldownMs)
    const recentAlerts = await fetchRecentAlerts(tx, cooldownStart)

    const proposals = evaluateTriggers({
      now,
      composites,
      recentCandidates,
      recentAlerts,
    })

    let alertsCreated = 0
    let alertsHeld = 0
    let alertsPending = 0

    for (const proposal of proposals) {
      const ticker = tickers.find((t) => t.id === proposal.tickerId)
      if (!ticker) continue
      const entryPrice = await latestEntryPrice(tx, proposal.tickerId)
      if (entryPrice === null) {
        logger.warn(
          { symbol: proposal.symbol, tickerId: proposal.tickerId },
          'engine.tick skipping proposal — no recent price',
        )
        continue
      }

      const eventClassId = proposal.topEventClassSlug
        ? (await tx.eventClass.findUnique({
            where: { slug: proposal.topEventClassSlug },
            select: { id: true },
          }))?.id ?? null
        : null

      const comparables = await comparableStatsFor(tx, eventClassId, proposal.symbol)
      const gate = gateAlert(now, ticker.exchange !== 'OSE' && ticker.exchange !== 'LON')

      const alert = await tx.alert.create({
        data: {
          tickerId: proposal.tickerId,
          direction: proposal.direction,
          entryPrice,
          thesis: buildThesis(proposal, composites),
          topCatalyst: proposal.topExcerpt,
          expectedReturn5d: comparables.expectedReturn5d,
          hitRate: comparables.hitRate,
          nComparables: comparables.nComparables,
          invalidation: buildInvalidation(proposal),
          compositeScoreAtFire: proposal.compositeScore,
          state: gate.state,
          firedAt: now,
          deliverAt: gate.deliverAt,
          sources: {
            create: await buildAlertSources(tx, proposal.contributingCandidateIds),
          },
        },
        select: { id: true },
      })
      alertsCreated++
      if (gate.state === 'held') alertsHeld++
      else alertsPending++

      logger.info(
        {
          alertId: alert.id,
          symbol: proposal.symbol,
          direction: proposal.direction,
          score: Number(proposal.compositeScore.toFixed(3)),
          state: gate.state,
          deliverAt: gate.deliverAt?.toISOString() ?? null,
        },
        'engine.tick alert created',
      )
    }

    return {
      startedAt,
      finishedAt: new Date(),
      decayMutations,
      apply,
      compositeCount: composites.length,
      proposalsEvaluated: proposals.length,
      alertsCreated,
      alertsHeld,
      alertsPending,
    }
  })
}

async function runDecay(tx: Tx, now: Date): Promise<number> {
  const [factorRows, stateRows] = await Promise.all([
    tx.factorDefinition.findMany(),
    tx.factorState.findMany(),
  ])

  const factorById = new Map<number, FactorDef>(
    factorRows.map((f) => [
      f.id,
      {
        id: f.id,
        slug: f.slug,
        rangeMin: f.rangeMin,
        rangeMax: f.rangeMax,
        defaultValue: f.defaultValue,
        weight: f.weight,
        decayHalfLifeDays: decayHalfLifeForSlug(f.slug),
      } satisfies FactorDef,
    ]),
  )

  let mutations = 0
  for (const row of stateRows) {
    const factor = factorById.get(row.factorId)
    if (!factor || factor.decayHalfLifeDays === null) continue
    if (row.value === 0) continue
    const elapsedMs = now.getTime() - row.updatedAt.getTime()
    const newValue = decayFactorValue(factor, row.value, elapsedMs)
    if (newValue === row.value) continue
    await tx.factorState.update({
      where: { tickerId_factorId: { tickerId: row.tickerId, factorId: row.factorId } },
      data: { value: newValue },
    })
    await tx.factorStateHistory.create({
      data: {
        tickerId: row.tickerId,
        factorId: row.factorId,
        oldValue: row.value,
        newValue,
        delta: newValue - row.value,
        reason: `decay (half-life ${factor.decayHalfLifeDays}d)`,
      },
    })
    mutations++
  }
  return mutations
}

async function fetchUnconsumedCandidates(tx: Tx): Promise<UnconsumedCandidateRow[]> {
  const rows = await tx.eventCandidate.findMany({
    where: { consumedAt: null },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    include: { eventClass: { select: { slug: true } } },
  })
  return rows.map((r) => ({
    id: r.id,
    sourceKind: r.sourceKind,
    sourceRefId: r.sourceRefId,
    eventClassId: r.eventClassId,
    overallConfidence: r.overallConfidence,
    createdAt: r.createdAt,
    extractedJson: r.extractedJson,
    eventClass: r.eventClass,
  }))
}

async function recomputeComposites(tx: Tx): Promise<{
  composites: CompositeScore[]
  factors: FactorDef[]
  tickers: Array<{ id: number; symbol: string; exchange: string }>
}> {
  const [tickerRows, factorRows, stateRows] = await Promise.all([
    tx.ticker.findMany({ where: { active: true }, select: { id: true, symbol: true, exchange: true } }),
    tx.factorDefinition.findMany(),
    tx.factorState.findMany({ select: { tickerId: true, factorId: true, value: true, updatedAt: true } }),
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
  const states: FactorStateRow[] = stateRows
  const composites = computeCompositeScores(tickerRows, factors, states)
  return { composites, factors, tickers: tickerRows }
}

async function fetchRecentCandidates(
  tx: Tx,
  since: Date,
): Promise<Array<CandidateInput & { tickerId: number }>> {
  // Consumed candidates too — a candidate applied in an earlier tick still
  // supports its ticker's confirmation count within the 24h window.
  const [rows, tickers] = await Promise.all([
    tx.eventCandidate.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: 'asc' },
      include: { eventClass: { select: { slug: true } } },
    }),
    tx.ticker.findMany({ where: { active: true }, select: { id: true, symbol: true } }),
  ])
  const tickerBySymbol = new Map(tickers.map((t) => [t.symbol, t.id] as const))

  const out: Array<CandidateInput & { tickerId: number }> = []
  for (const row of rows) {
    const json = row.extractedJson as Record<string, unknown> | null
    if (!json) continue
    const sentiment = (json.sentiment as CandidateInput['sentiment']) ?? 'neutral'
    const excerpt = typeof json.excerpt === 'string' ? json.excerpt : ''
    const affected = Array.isArray(json.affectedTickers)
      ? (json.affectedTickers as Array<{ symbol: string; confidence: number }>)
      : []
    for (const t of affected) {
      const tickerId = tickerBySymbol.get(t.symbol)
      if (!tickerId) continue
      out.push({
        id: row.id,
        sourceKind: row.sourceKind,
        sourceRefId: row.sourceRefId,
        eventClassSlug: row.eventClass?.slug ?? null,
        createdAt: row.createdAt,
        affectedTickers: affected,
        sentiment,
        proposedFactorDeltas: [],
        overallConfidence: row.overallConfidence,
        excerpt,
        tickerId,
      })
    }
  }
  return out
}

async function fetchRecentAlerts(tx: Tx, since: Date): Promise<RecentAlertRef[]> {
  const rows = await tx.alert.findMany({
    where: {
      firedAt: { gte: since },
      state: { in: ['pending', 'held', 'delivered'] },
    },
    select: { tickerId: true, direction: true, firedAt: true },
  })
  return rows.map((r) => ({ tickerId: r.tickerId, direction: r.direction, firedAt: r.firedAt }))
}

async function buildAlertSources(
  tx: Tx,
  candidateIds: ReadonlyArray<number>,
): Promise<Array<{ newsItemId: number | null; xPostId: number | null; contributionWeight: number }>> {
  if (candidateIds.length === 0) return []
  const candidates = await tx.eventCandidate.findMany({
    where: { id: { in: [...candidateIds] } },
    select: { id: true, sourceKind: true, sourceRefId: true, overallConfidence: true },
  })
  const totalWeight = candidates.reduce((sum, c) => sum + c.overallConfidence, 0) || 1
  return candidates.map((c) => ({
    newsItemId: c.sourceKind === 'news' ? c.sourceRefId : null,
    xPostId: c.sourceKind === 'x' ? c.sourceRefId : null,
    contributionWeight: c.overallConfidence / totalWeight,
  }))
}

function buildThesis(proposal: TriggerProposal, composites: ReadonlyArray<CompositeScore>): string {
  const score = composites.find((c) => c.tickerId === proposal.tickerId)
  const topContribs = (score?.contributions ?? [])
    .filter((c) => (proposal.direction === 'long' ? c.contribution > 0 : c.contribution < 0))
    .slice(0, 3)
    .map((c) => `${c.factorSlug} (${c.value.toFixed(2)})`)
    .join(', ')
  const directionWord = proposal.direction === 'long' ? 'Bullish' : 'Bearish'
  return `${directionWord} composite ${proposal.compositeScore.toFixed(2)}; top contributors: ${topContribs || '—'}.`
}

function buildInvalidation(proposal: TriggerProposal): string {
  if (!proposal.topEventClassSlug) return 'Composite score falls below threshold.'
  const opposite = proposal.direction === 'long' ? 'bearish' : 'bullish'
  return `${opposite.charAt(0).toUpperCase()}${opposite.slice(1)} follow-up on ${proposal.topEventClassSlug}, or composite score falls below threshold.`
}
