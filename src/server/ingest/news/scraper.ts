import * as cheerio from 'cheerio'
import type { NormalizedItem } from './dedup.js'

// Fallback scraper for sources without a usable RSS feed. Hand-written per source
// via the registry below — resists the temptation to build a general-purpose
// readability pipeline in v1. When adding a source, supply a parse function that
// returns the links + titles visible on the listing page; body text is optional.

type ScraperParse = (url: string, html: string) => NormalizedItem[]

const SCRAPERS: Record<string, ScraperParse> = {
  // OPEC press room landing page: each release is an <a> tag under .press_releases.
  'www.opec.org': (_baseUrl, html) => {
    const $ = cheerio.load(html)
    const out: NormalizedItem[] = []
    $('a').each((_, el) => {
      const href = $(el).attr('href')
      const title = $(el).text().trim()
      if (!href || !title) return
      if (!/press_release|press_releases|\/(20\d{2})\//i.test(href)) return
      const abs = href.startsWith('http') ? href : new URL(href, 'https://www.opec.org/').toString()
      if (!/opec\.org/.test(abs)) return
      out.push({ url: abs, title, bodyText: null, publishedAt: null })
    })
    return out
  },
}

export async function fetchScraped(url: string): Promise<NormalizedItem[]> {
  const host = new URL(url).hostname
  const parse = SCRAPERS[host]
  if (!parse) {
    throw new Error(`No scraper registered for host ${host} — add an entry in scraper.ts`)
  }
  const res = await fetch(url, {
    headers: { 'User-Agent': 'analyst-agent/0.1 (+https://github.com/PetterIve/analyst)' },
  })
  if (!res.ok) {
    throw new Error(`${url} returned HTTP ${res.status}`)
  }
  const html = await res.text()
  return parse(url, html)
}
