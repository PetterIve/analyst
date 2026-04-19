import { prisma } from '../../db.js'
import { contentHash, dedupeBatch, type NormalizedItem } from './dedup.js'
import { fetchRss } from './rss.js'
import { fetchScraped } from './scraper.js'

export interface SourceResult {
  sourceId: number
  name: string
  skipped: boolean
  fetched: number
  inserted: number
  error: string | null
}

export interface IngestResult {
  startedAt: Date
  finishedAt: Date
  perSource: SourceResult[]
  totalInserted: number
}

export async function runNewsIngest(opts: { force?: boolean } = {}): Promise<IngestResult> {
  const startedAt = new Date()
  const sources = await prisma.newsSource.findMany({ where: { active: true } })

  const perSource = await Promise.all(
    sources.map((source) => ingestOneSource(source, opts.force ?? false)),
  )

  const finishedAt = new Date()
  const totalInserted = perSource.reduce((n, r) => n + r.inserted, 0)
  return { startedAt, finishedAt, perSource, totalInserted }
}

type SourceRow = Awaited<ReturnType<typeof prisma.newsSource.findMany>>[number]

async function ingestOneSource(source: SourceRow, force: boolean): Promise<SourceResult> {
  const base: SourceResult = {
    sourceId: source.id,
    name: source.name,
    skipped: false,
    fetched: 0,
    inserted: 0,
    error: null,
  }

  const now = Date.now()
  if (!force && source.lastFetchedAt) {
    const ageSec = (now - source.lastFetchedAt.getTime()) / 1000
    if (ageSec < source.pollIntervalSec) {
      return { ...base, skipped: true }
    }
  }

  try {
    const raw = await fetchFromSource(source)
    const deduped = dedupeBatch(raw)
    const inserted = await persistItems(source.id, deduped)
    await prisma.newsSource.update({
      where: { id: source.id },
      data: { lastFetchedAt: new Date(), lastError: null },
    })
    return { ...base, fetched: deduped.length, inserted }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await prisma.newsSource.update({
      where: { id: source.id },
      data: { lastFetchedAt: new Date(), lastError: message },
    })
    return { ...base, error: message }
  }
}

async function fetchFromSource(source: SourceRow): Promise<NormalizedItem[]> {
  if (source.kind === 'rss') {
    if (!source.rssUrl) {
      throw new Error('RSS source has no rssUrl configured')
    }
    return fetchRss(source.rssUrl)
  }
  return fetchScraped(source.url)
}

async function persistItems(sourceId: number, items: NormalizedItem[]): Promise<number> {
  if (items.length === 0) return 0
  // createMany with skipDuplicates handles the URL @unique collision; the
  // content_hash dedup is informational (two different URLs pointing at the
  // same story — we keep them but downstream can merge).
  const result = await prisma.newsItem.createMany({
    data: items.map((it) => ({
      sourceId,
      url: it.url,
      title: it.title,
      bodyText: it.bodyText,
      publishedAt: it.publishedAt,
      contentHash: contentHash(it.title, it.bodyText),
    })),
    skipDuplicates: true,
  })
  return result.count
}
