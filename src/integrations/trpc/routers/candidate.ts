import { TRPCError, type TRPCRouterRecord } from '@trpc/server'
import { z } from 'zod'
import { prisma } from '#/server/db'
import { eventCandidateSchema } from '#/lib/extractor'
import { publicProcedure } from '../init'

export const candidateRouter = {
  list: publicProcedure
    .input(
      z
        .object({
          sourceKind: z.enum(['news', 'x']).optional(),
          eventClassSlug: z.string().min(1).max(100).optional(),
          consumed: z.enum(['any', 'consumed', 'pending']).default('any'),
          minConfidence: z.number().min(0).max(1).optional(),
          limit: z.number().int().min(1).max(200).default(50),
          cursor: z.number().int().optional(),
        })
        .default({ consumed: 'any', limit: 50 }),
    )
    .query(async ({ input }) => {
      const where = {
        ...(input.sourceKind ? { sourceKind: input.sourceKind } : {}),
        ...(input.eventClassSlug
          ? { eventClass: { slug: input.eventClassSlug } }
          : {}),
        ...(input.consumed === 'consumed' ? { consumedAt: { not: null } } : {}),
        ...(input.consumed === 'pending' ? { consumedAt: null } : {}),
        ...(input.minConfidence !== undefined
          ? { overallConfidence: { gte: input.minConfidence } }
          : {}),
      }
      const rows = await prisma.eventCandidate.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        include: {
          eventClass: { select: { slug: true, name: true } },
        },
      })
      let nextCursor: number | null = null
      if (rows.length > input.limit) {
        const next = rows.pop()
        nextCursor = next?.id ?? null
      }
      return {
        items: rows.map((r) => ({
          id: r.id,
          sourceKind: r.sourceKind,
          sourceRefId: r.sourceRefId,
          eventClassSlug: r.eventClass?.slug ?? null,
          eventClassName: r.eventClass?.name ?? null,
          overallConfidence: r.overallConfidence,
          createdAt: r.createdAt,
          consumedAt: r.consumedAt,
          summary: summarize(r.extractedJson),
        })),
        nextCursor,
      }
    }),

  byId: publicProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ input }) => {
      const row = await prisma.eventCandidate.findUnique({
        where: { id: input.id },
        include: {
          eventClass: {
            select: { slug: true, name: true, defaultFactorDeltas: true },
          },
        },
      })
      if (!row) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Unknown candidate id: ${input.id}`,
        })
      }

      // Re-validate the stored JSON so stale rows written before a schema
      // change surface a clear error instead of rendering garbage.
      const parsed = eventCandidateSchema.safeParse(row.extractedJson)
      const candidate = parsed.success ? parsed.data : null

      const source = await loadSource(row.sourceKind, row.sourceRefId)

      return {
        id: row.id,
        sourceKind: row.sourceKind,
        sourceRefId: row.sourceRefId,
        createdAt: row.createdAt,
        consumedAt: row.consumedAt,
        overallConfidence: row.overallConfidence,
        eventClass: row.eventClass,
        candidate,
        rawJson: row.extractedJson,
        parseError: parsed.success ? null : parsed.error.message,
        source,
      }
    }),

  /**
   * Bulk lookup: latest candidate per source ref id, for a given source kind.
   * Used by the news inbox to render an extraction column alongside rows
   * without an N+1 query.
   */
  latestBySourceIds: publicProcedure
    .input(
      z.object({
        sourceKind: z.enum(['news', 'x']),
        sourceRefIds: z.array(z.number().int()).min(0).max(500),
      }),
    )
    .query(async ({ input }) => {
      if (input.sourceRefIds.length === 0) return {} as Record<number, {
        id: number
        eventClassSlug: string | null
        overallConfidence: number
        sentiment: string | null
        tickers: string[]
      }>

      const rows = await prisma.eventCandidate.findMany({
        where: {
          sourceKind: input.sourceKind,
          sourceRefId: { in: input.sourceRefIds },
        },
        orderBy: [{ sourceRefId: 'asc' }, { createdAt: 'desc' }, { id: 'desc' }],
        include: { eventClass: { select: { slug: true } } },
      })

      const out: Record<number, {
        id: number
        eventClassSlug: string | null
        overallConfidence: number
        sentiment: string | null
        tickers: string[]
      }> = {}
      for (const r of rows) {
        if (out[r.sourceRefId]) continue // already have the latest (first row per id)
        const summary = summarize(r.extractedJson)
        out[r.sourceRefId] = {
          id: r.id,
          eventClassSlug: r.eventClass?.slug ?? null,
          overallConfidence: r.overallConfidence,
          sentiment: summary.sentiment,
          tickers: summary.tickers,
        }
      }
      return out
    }),

  /**
   * Fetch the latest candidate for a given source item — used by the
   * "Extraction" panel on the news/x detail rows. Returns null when the
   * item hasn't been processed yet.
   */
  latestForSource: publicProcedure
    .input(
      z.object({
        sourceKind: z.enum(['news', 'x']),
        sourceRefId: z.number().int(),
      }),
    )
    .query(async ({ input }) => {
      const row = await prisma.eventCandidate.findFirst({
        where: {
          sourceKind: input.sourceKind,
          sourceRefId: input.sourceRefId,
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: { eventClass: { select: { slug: true, name: true } } },
      })
      if (!row) return null
      return {
        id: row.id,
        createdAt: row.createdAt,
        consumedAt: row.consumedAt,
        overallConfidence: row.overallConfidence,
        eventClassSlug: row.eventClass?.slug ?? null,
        eventClassName: row.eventClass?.name ?? null,
        summary: summarize(row.extractedJson),
      }
    }),
} satisfies TRPCRouterRecord

async function loadSource(kind: 'news' | 'x' | 'manual', refId: number) {
  if (kind === 'news') {
    const news = await prisma.newsItem.findUnique({
      where: { id: refId },
      include: { source: { select: { name: true } } },
    })
    if (!news) return null
    return {
      kind: 'news' as const,
      id: news.id,
      title: news.title,
      bodyText: news.bodyText,
      url: news.url,
      publishedAt: news.publishedAt,
      sourceName: news.source.name,
    }
  }
  if (kind === 'x') {
    const post = await prisma.xPost.findUnique({
      where: { id: refId },
      include: { account: { select: { handle: true } } },
    })
    if (!post) return null
    return {
      kind: 'x' as const,
      id: post.id,
      text: post.text,
      postedAt: post.postedAt,
      sourceName: `@${post.account.handle}`,
      postId: post.postId,
    }
  }
  return null
}

interface CandidateSummary {
  sentiment: string | null
  tickers: string[]
  excerpt: string | null
}

function summarize(raw: unknown): CandidateSummary {
  const parsed = eventCandidateSchema.safeParse(raw)
  if (!parsed.success) {
    return { sentiment: null, tickers: [], excerpt: null }
  }
  return {
    sentiment: parsed.data.sentiment,
    tickers: parsed.data.affectedTickers.map((t) => t.symbol),
    excerpt: parsed.data.excerpt,
  }
}
