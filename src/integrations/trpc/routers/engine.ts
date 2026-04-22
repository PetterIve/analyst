import type { TRPCRouterRecord } from '@trpc/server'
import { z } from 'zod'
import { prisma } from '#/server/db'
import { computeCompositeScores } from '#/lib/engine/composite'
import { computeFactorUpdate } from '#/lib/engine/update-factor'
import { decayHalfLifeForSlug } from '#/lib/engine/factor-meta'
import { evaluateTriggers, DEFAULT_TRIGGER_CONFIG } from '#/lib/engine/trigger'
import type { CandidateInput, FactorDef, FactorStateRow } from '#/lib/engine/types'
import { publicProcedure } from '../init'

const simulationInputSchema = z.object({
  sentiment: z.enum(['bullish', 'bearish', 'neutral']),
  affectedTickers: z
    .array(z.object({ symbol: z.string().min(1).max(20), confidence: z.number().min(0).max(1) }))
    .min(1)
    .max(20),
  factorDeltas: z
    .array(
      z.object({
        factorSlug: z.string().min(1),
        delta: z.number().min(-2).max(2),
        reason: z.string().min(1).max(200),
      }),
    )
    .max(20),
  overallConfidence: z.number().min(0).max(1).default(0.7),
  excerpt: z.string().min(1).max(500).default('simulated candidate'),
})

/**
 * Dry-run: apply a hypothetical candidate to the current factor state
 * in-memory, recompute composites, and report whether a trigger would fire.
 * No DB writes. Used by the dashboard's simulation panel to let operators
 * reason about tuning without polluting real state.
 */
export const engineRouter = {
  simulate: publicProcedure
    .input(simulationInputSchema)
    .query(async ({ input }) => {
      const [tickerRows, factorRows, stateRows, recentCandidates] = await Promise.all([
        prisma.ticker.findMany({ where: { active: true }, select: { id: true, symbol: true } }),
        prisma.factorDefinition.findMany(),
        prisma.factorState.findMany(),
        prisma.eventCandidate.findMany({
          where: { createdAt: { gte: new Date(Date.now() - DEFAULT_TRIGGER_CONFIG.supportingWindowMs) } },
          include: { eventClass: { select: { slug: true } } },
        }),
      ])

      const tickerBySymbol = new Map(tickerRows.map((t) => [t.symbol, t] as const))
      const factorBySlug = new Map(
        factorRows.map(
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

      // In-memory copy of state we can mutate without touching the DB.
      const simulatedState: FactorStateRow[] = stateRows.map((r) => ({ ...r }))
      const mutations: Array<{
        symbol: string
        factorSlug: string
        oldValue: number
        newValue: number
        delta: number
      }> = []

      for (const affected of input.affectedTickers) {
        const ticker = tickerBySymbol.get(affected.symbol)
        if (!ticker) continue
        for (const d of input.factorDeltas) {
          const factor = factorBySlug.get(d.factorSlug)
          if (!factor) continue
          const idx = simulatedState.findIndex(
            (s) => s.tickerId === ticker.id && s.factorId === factor.id,
          )
          const currentValue =
            idx >= 0 ? simulatedState[idx].value : factor.defaultValue
          const mutation = computeFactorUpdate(ticker.id, factor, currentValue, d.delta, d.reason)
          if (idx >= 0) simulatedState[idx].value = mutation.newValue
          else
            simulatedState.push({
              tickerId: ticker.id,
              factorId: factor.id,
              value: mutation.newValue,
              updatedAt: new Date(),
            })
          mutations.push({
            symbol: ticker.symbol,
            factorSlug: factor.slug,
            oldValue: mutation.oldValue,
            newValue: mutation.newValue,
            delta: mutation.delta,
          })
        }
      }

      const factors = [...factorBySlug.values()]
      const composites = computeCompositeScores(tickerRows, factors, simulatedState)

      // Synthesise the candidate record expected by the trigger evaluator. We
      // treat it as just-now arrival; real recent candidates join for the
      // confirmation count.
      const now = new Date()
      const simulatedCandidates: Array<CandidateInput & { tickerId: number }> = []
      for (const affected of input.affectedTickers) {
        const ticker = tickerBySymbol.get(affected.symbol)
        if (!ticker) continue
        simulatedCandidates.push({
          id: -1,
          tickerId: ticker.id,
          sourceKind: 'manual',
          sourceRefId: 0,
          eventClassSlug: null,
          createdAt: now,
          affectedTickers: input.affectedTickers,
          sentiment: input.sentiment,
          proposedFactorDeltas: input.factorDeltas,
          overallConfidence: input.overallConfidence,
          excerpt: input.excerpt,
        })
      }

      const windowStart = now.getTime() - DEFAULT_TRIGGER_CONFIG.supportingWindowMs
      const realRecent: Array<CandidateInput & { tickerId: number }> = []
      for (const row of recentCandidates) {
        const json = row.extractedJson as Record<string, unknown> | null
        if (!json) continue
        const sentiment = (json.sentiment as CandidateInput['sentiment']) ?? 'neutral'
        const affected = Array.isArray(json.affectedTickers)
          ? (json.affectedTickers as Array<{ symbol: string; confidence: number }>)
          : []
        for (const a of affected) {
          const ticker = tickerBySymbol.get(a.symbol)
          if (!ticker) continue
          if (row.createdAt.getTime() < windowStart) continue
          realRecent.push({
            id: row.id,
            tickerId: ticker.id,
            sourceKind: row.sourceKind,
            sourceRefId: row.sourceRefId,
            eventClassSlug: row.eventClass?.slug ?? null,
            createdAt: row.createdAt,
            affectedTickers: affected,
            sentiment,
            proposedFactorDeltas: [],
            overallConfidence: row.overallConfidence,
            excerpt: typeof json.excerpt === 'string' ? json.excerpt : '',
          })
        }
      }

      const proposals = evaluateTriggers({
        now,
        composites,
        recentCandidates: [...realRecent, ...simulatedCandidates],
        recentAlerts: [], // simulator ignores cooldown — operator is exploring "what if"
      })

      return {
        mutations,
        composites: composites
          .filter((c) => c.longScore > 0 || c.shortScore > 0)
          .sort((a, b) => Math.max(b.longScore, b.shortScore) - Math.max(a.longScore, a.shortScore)),
        wouldTrigger: proposals.map((p) => ({
          symbol: p.symbol,
          direction: p.direction,
          compositeScore: p.compositeScore,
          supportingCandidateIds: p.contributingCandidateIds,
        })),
      }
    }),
} satisfies TRPCRouterRecord
