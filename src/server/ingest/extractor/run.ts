import { prisma } from '#/server/db'
import {
  extractBatch,
  loadTaxonomy,
  type BatchItem,
  type BatchItemOutcome,
  type ExtractorInput,
} from '#/lib/extractor'
import type { ExtractorModel } from '#/lib/anthropic.server'
import {
  costOf,
  sumUsage,
  type CostBreakdown,
  type TokenUsage,
} from '#/lib/extractor/pricing'

type SourceKey =
  | { kind: 'news'; id: number }
  | { kind: 'x'; id: number }

export interface ItemOutcome {
  sourceKind: 'news' | 'x'
  sourceRefId: number
  candidateId: number | null
  eventClassSlug: string | null
  overallConfidence: number | null
  error: string | null
}

export interface ExtractRunResult {
  startedAt: Date
  finishedAt: Date
  model: ExtractorModel
  itemsProcessed: number
  candidatesWritten: number
  errors: number
  usage: TokenUsage
  cost: CostBreakdown
  perItem: ItemOutcome[]
}

export interface RunExtractorOptions {
  model?: ExtractorModel
  limit?: number
  concurrency?: number
  onItemEnd?: (outcome: ItemOutcome) => void
}

/**
 * Pull up to `limit` unprocessed news items + X posts, run the extractor
 * over all of them, write `event_candidates` rows, and mark sources
 * `processed_at`. Caller (cron handler) owns the CronRun row + top-level
 * logging; this lib is reusable from tRPC "Run now" buttons with its own
 * logging context.
 */
export async function runExtractor(
  opts: RunExtractorOptions = {},
): Promise<ExtractRunResult> {
  const model: ExtractorModel = opts.model ?? 'claude-sonnet-4-6'
  const limit = Math.max(1, Math.min(opts.limit ?? 50, 200))
  const concurrency = Math.max(1, Math.min(opts.concurrency ?? 4, 16))
  const startedAt = new Date()

  const taxonomy = await loadTaxonomy()
  const slugToDbId = new Map<string, number>()
  for (const row of await prisma.eventClass.findMany({
    select: { id: true, slug: true },
  })) {
    slugToDbId.set(row.slug, row.id)
  }

  // Fetch unprocessed items, oldest first so we don't starve stale rows.
  const news = await prisma.newsItem.findMany({
    where: { processedAt: null },
    orderBy: [{ publishedAt: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }],
    take: limit,
    include: { source: { select: { name: true } } },
  })
  const remaining = Math.max(0, limit - news.length)
  const xPosts = remaining
    ? await prisma.xPost.findMany({
        where: { processedAt: null },
        orderBy: [{ postedAt: 'asc' }, { id: 'asc' }],
        take: remaining,
        include: { account: { select: { handle: true } } },
      })
    : []

  const items: BatchItem<SourceKey>[] = [
    ...news.map((n) => ({
      key: { kind: 'news' as const, id: n.id },
      input: {
        kind: 'news' as const,
        title: n.title,
        body: n.bodyText ?? n.title,
        sourceName: n.source.name,
        publishedAt: n.publishedAt,
      } satisfies ExtractorInput,
    })),
    ...xPosts.map((p) => ({
      key: { kind: 'x' as const, id: p.id },
      input: {
        kind: 'x' as const,
        body: p.text,
        sourceName: `@${p.account.handle}`,
        publishedAt: p.postedAt,
      } satisfies ExtractorInput,
    })),
  ]

  if (items.length === 0) {
    return {
      startedAt,
      finishedAt: new Date(),
      model,
      itemsProcessed: 0,
      candidatesWritten: 0,
      errors: 0,
      usage: sumUsage([]),
      cost: costOf(model, sumUsage([])),
      perItem: [],
    }
  }

  const batch = await extractBatch({
    taxonomy,
    items,
    model,
    concurrency,
  })

  const perItem: ItemOutcome[] = []
  let candidatesWritten = 0
  const now = new Date()

  // Persist in a single transaction per batch so half-baked state can't leak.
  await prisma.$transaction(async (tx) => {
    for (const outcome of batch.outcomes) {
      if (!outcome) continue
      const entry = await persistOutcome({
        tx,
        outcome,
        slugToDbId,
        now,
      })
      if (entry.candidateId !== null) candidatesWritten++
      perItem.push(entry)
      opts.onItemEnd?.(entry)
    }
  })

  return {
    startedAt,
    finishedAt: new Date(),
    model,
    itemsProcessed: items.length,
    candidatesWritten,
    errors: batch.errorCount,
    usage: batch.totalUsage,
    cost: costOf(model, batch.totalUsage),
    perItem,
  }
}

async function persistOutcome(args: {
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
  outcome: BatchItemOutcome<SourceKey>
  slugToDbId: Map<string, number>
  now: Date
}): Promise<ItemOutcome> {
  const { tx, outcome, slugToDbId, now } = args
  const key = outcome.key

  // Persistent errors (malformed tool output): mark processed so we don't
  // retry forever on a bad input. Transient errors (network/auth/rate-limit):
  // leave processedAt null so the next cron run picks the item up again.
  if (outcome.error || !outcome.result) {
    if (outcome.errorKind === 'malformed') {
      await markProcessed(tx, key, now)
    }
    return {
      sourceKind: key.kind,
      sourceRefId: key.id,
      candidateId: null,
      eventClassSlug: null,
      overallConfidence: null,
      error: outcome.error,
    }
  }

  const { candidate } = outcome.result
  const eventClassId = candidate.eventClassSlug
    ? (slugToDbId.get(candidate.eventClassSlug) ?? null)
    : null

  const row = await tx.eventCandidate.create({
    data: {
      sourceKind: key.kind,
      sourceRefId: key.id,
      extractedJson: candidate as unknown as object,
      eventClassId,
      overallConfidence: candidate.overallConfidence,
    },
    select: { id: true },
  })

  await markProcessed(tx, key, now)

  return {
    sourceKind: key.kind,
    sourceRefId: key.id,
    candidateId: row.id,
    eventClassSlug: candidate.eventClassSlug,
    overallConfidence: candidate.overallConfidence,
    error: null,
  }
}

async function markProcessed(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  key: SourceKey,
  now: Date,
) {
  if (key.kind === 'news') {
    await tx.newsItem.update({
      where: { id: key.id },
      data: { processedAt: now },
    })
  } else {
    await tx.xPost.update({
      where: { id: key.id },
      data: { processedAt: now },
    })
  }
}
