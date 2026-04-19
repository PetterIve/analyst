import Parser from 'rss-parser'
import * as cheerio from 'cheerio'
import type { NormalizedItem } from './dedup.js'

const parser = new Parser({
  timeout: 15_000,
  headers: { 'User-Agent': 'analyst-agent/0.1 (+https://github.com/PetterIve/analyst)' },
})

function stripHtml(input: string | undefined | null): string | null {
  if (!input) return null
  const text = cheerio.load(input).text().replace(/\s+/g, ' ').trim()
  return text || null
}

function parseDate(input: string | undefined): Date | null {
  if (!input) return null
  const d = new Date(input)
  return Number.isNaN(d.getTime()) ? null : d
}

export async function parseRssFromString(xml: string): Promise<NormalizedItem[]> {
  const feed = await parser.parseString(xml)
  return normalize(feed.items ?? [])
}

export async function fetchRss(url: string): Promise<NormalizedItem[]> {
  const feed = await parser.parseURL(url)
  return normalize(feed.items ?? [])
}

type RssItem = Awaited<ReturnType<typeof parser.parseString>>['items'][number]

function normalize(items: RssItem[]): NormalizedItem[] {
  const out: NormalizedItem[] = []
  for (const item of items) {
    const url = item.link?.trim()
    const title = item.title?.trim()
    if (!url || !title) continue
    const bodyText =
      stripHtml(item['content:encoded'] as string | undefined) ??
      stripHtml(item.content) ??
      stripHtml(item.contentSnippet) ??
      stripHtml(item.summary)
    out.push({
      url,
      title,
      bodyText,
      publishedAt: parseDate(item.isoDate ?? item.pubDate),
    })
  }
  return out
}
