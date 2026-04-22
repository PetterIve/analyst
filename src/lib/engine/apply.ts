import type { PrismaClient } from '#/generated/prisma/client'
import { logger } from '#/lib/logger.server'
import { parseExtractedCandidate } from './candidate-json'
import { computeFactorUpdate } from './update-factor'
import type { CandidateInput, FactorDef, FactorDelta } from './types'

export interface ApplyResult {
  /** Candidates we read but could not apply (unknown ticker, malformed JSON, …). Still marked consumed. */
  skipped: number
  /** Number of candidates whose deltas were applied. */
  applied: number
  /** One entry per successfully applied candidate (for downstream trigger eval). */
  canonicalized: Array<CandidateInput & { tickerId: number }>
  /** Mutations performed, grouped by candidate. For observability. */
  mutations: number
}

type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0]

interface ApplyContext {
  tx: Tx
  tickerBySymbol: Map<string, { id: number; symbol: string }>
  factorBySlug: Map<string, FactorDef>
  /** Event class id -> default factor deltas (json array) */
  eventClassDefaults: Map<number, FactorDelta[]>
  now: Date
}

function pickDeltas(
  candidateDeltas: FactorDelta[],
  eventClassId: number | null,
  defaults: Map<number, FactorDelta[]>,
): FactorDelta[] {
  // Hybrid rule (per T07 decision): if the LLM produced deltas, trust them;
  // otherwise fall back to event-class defaults. Empty arrays on both sides →
  // candidate contributes state mutations only via decay/downstream triggers.
  if (candidateDeltas.length > 0) return candidateDeltas
  if (eventClassId == null) return []
  return defaults.get(eventClassId) ?? []
}

function parseDefaultDeltas(raw: unknown): FactorDelta[] {
  if (!Array.isArray(raw)) return []
  const out: FactorDelta[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const e = entry as Record<string, unknown>
    const factorSlug = typeof e.factorSlug === 'string' ? e.factorSlug : null
    const delta = typeof e.delta === 'number' && Number.isFinite(e.delta) ? e.delta : null
    const reason = typeof e.reason === 'string' ? e.reason : null
    if (factorSlug && delta !== null && reason) out.push({ factorSlug, delta, reason })
  }
  return out
}

async function buildContext(tx: Tx): Promise<Omit<ApplyContext, 'tx' | 'now'>> {
  const [tickers, factors, eventClasses] = await Promise.all([
    tx.ticker.findMany({ select: { id: true, symbol: true, active: true } }),
    tx.factorDefinition.findMany(),
    tx.eventClass.findMany({ select: { id: true, defaultFactorDeltas: true } }),
  ])

  const { decayHalfLifeForSlug } = await import('./factor-meta')

  const tickerBySymbol = new Map(
    tickers.filter((t) => t.active).map((t) => [t.symbol, { id: t.id, symbol: t.symbol }] as const),
  )
  const factorBySlug = new Map(
    factors.map(
      (f) =>
        [
          f.slug,
          {
            id: f.id,
            slug: f.slug,
            rangeMin: f.rangeMin,
            rangeMax: f.rangeMax,
            defaultValue: f.defaultValue,
            weight: f.weight,
            decayHalfLifeDays: decayHalfLifeForSlug(f.slug),
          } satisfies FactorDef,
        ] as const,
    ),
  )
  const eventClassDefaults = new Map(
    eventClasses.map((ec) => [ec.id, parseDefaultDeltas(ec.defaultFactorDeltas)] as const),
  )
  return { tickerBySymbol, factorBySlug, eventClassDefaults }
}

export interface UnconsumedCandidateRow {
  id: number
  sourceKind: 'news' | 'x' | 'manual'
  sourceRefId: number
  eventClassId: number | null
  overallConfidence: number
  createdAt: Date
  extractedJson: unknown
  eventClass: { slug: string } | null
}

/**
 * Apply all unconsumed event candidates to factor_state.
 *
 * - Malformed extracted_json or unknown tickers are logged and the candidate
 *   is still marked consumed (we'd only burn cycles trying again).
 * - Every mutation appends a `factor_state_history` row whose reason cites
 *   the event class + LLM-provided reason. Non-negotiable per T09.
 * - Returns canonicalized candidate records so the orchestrator can hand
 *   them to the trigger evaluator without re-reading the DB.
 */
export async function applyCandidates(
  tx: Tx,
  candidates: ReadonlyArray<UnconsumedCandidateRow>,
  now: Date,
): Promise<ApplyResult> {
  const base = await buildContext(tx)
  let applied = 0
  let skipped = 0
  let mutations = 0
  const canonicalized: ApplyResult['canonicalized'] = []

  for (const row of candidates) {
    const parsed = parseExtractedCandidate(row.extractedJson)
    if (!parsed) {
      logger.warn({ candidateId: row.id }, 'engine.apply malformed json — skipping')
      await markConsumed(tx, row.id, now)
      skipped++
      continue
    }

    const affectedTickerIds: Array<{ tickerId: number; symbol: string }> = []
    for (const t of parsed.affectedTickers) {
      const ticker = base.tickerBySymbol.get(t.symbol)
      if (!ticker) {
        logger.debug(
          { candidateId: row.id, symbol: t.symbol },
          'engine.apply unknown ticker — skipping per-ticker',
        )
        continue
      }
      affectedTickerIds.push({ tickerId: ticker.id, symbol: ticker.symbol })
    }

    if (affectedTickerIds.length === 0) {
      // Nothing to mutate, but still consume so we don't replay.
      await markConsumed(tx, row.id, now)
      skipped++
      continue
    }

    const deltas = pickDeltas(parsed.proposedFactorDeltas, row.eventClassId, base.eventClassDefaults)

    for (const { tickerId } of affectedTickerIds) {
      for (const d of deltas) {
        const factor = base.factorBySlug.get(d.factorSlug)
        if (!factor) {
          logger.debug(
            { candidateId: row.id, factor: d.factorSlug },
            'engine.apply unknown factor — skipping delta',
          )
          continue
        }

        // Lock-free read: factor_state has a unique (ticker, factor) key. We
        // read, compute, and upsert; concurrent ticks are guarded by the
        // outer transaction and the 5-min cron cadence.
        const existing = await tx.factorState.findUnique({
          where: { tickerId_factorId: { tickerId, factorId: factor.id } },
          select: { value: true },
        })
        const currentValue = existing?.value ?? factorDefaultFor(factor)
        const mutation = computeFactorUpdate(
          tickerId,
          factor,
          currentValue,
          d.delta,
          `candidate ${row.id} (${row.eventClass?.slug ?? 'unclassified'}): ${d.reason}`,
        )
        if (mutation.delta === 0) continue // clamped out — skip history row

        await tx.factorState.upsert({
          where: { tickerId_factorId: { tickerId, factorId: factor.id } },
          create: {
            tickerId,
            factorId: factor.id,
            value: mutation.newValue,
          },
          update: { value: mutation.newValue },
        })
        await tx.factorStateHistory.create({
          data: {
            tickerId,
            factorId: factor.id,
            oldValue: mutation.oldValue,
            newValue: mutation.newValue,
            delta: mutation.delta,
            reason: mutation.reason,
          },
        })
        mutations++
      }

      canonicalized.push({
        id: row.id,
        tickerId,
        sourceKind: row.sourceKind,
        sourceRefId: row.sourceRefId,
        eventClassSlug: row.eventClass?.slug ?? null,
        createdAt: row.createdAt,
        affectedTickers: parsed.affectedTickers,
        sentiment: parsed.sentiment,
        proposedFactorDeltas: parsed.proposedFactorDeltas,
        overallConfidence: parsed.overallConfidence,
        excerpt: parsed.excerpt,
      })
    }

    await markConsumed(tx, row.id, now)
    applied++
  }

  return { applied, skipped, mutations, canonicalized }
}

function factorDefaultFor(factor: FactorDef): number {
  return factor.defaultValue
}

async function markConsumed(tx: Tx, candidateId: number, now: Date) {
  await tx.eventCandidate.update({
    where: { id: candidateId },
    data: { consumedAt: now },
  })
}
