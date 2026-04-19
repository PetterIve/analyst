import type { NewsSourceKind } from '../../generated/prisma/client.js'

export interface NewsSourceSeed {
  name: string
  url: string
  rssUrl: string | null
  kind: NewsSourceKind
  pollIntervalSec: number
  notes: string
}

// Starter list per T04. Paid sources (TradeWinds, Lloyd's List) are included
// in headlines-only mode — their public RSS exposes titles + summaries but not
// full article text. Fill in `rssUrl: null` to route a source through the
// cheerio scraper fallback instead.
export const newsSourceSeeds: ReadonlyArray<NewsSourceSeed> = [
  {
    name: 'Reuters — Energy',
    url: 'https://www.reuters.com/business/energy/',
    rssUrl: 'https://news.google.com/rss/search?q=site%3Areuters.com+energy&hl=en-US&gl=US&ceid=US%3Aen',
    kind: 'rss',
    pollIntervalSec: 300,
    notes: 'Reuters retired its native RSS; pulled via Google News site search.',
  },
  {
    name: 'Reuters — Shipping',
    url: 'https://www.reuters.com/business/shipping/',
    rssUrl: 'https://news.google.com/rss/search?q=site%3Areuters.com+shipping+OR+tanker&hl=en-US&gl=US&ceid=US%3Aen',
    kind: 'rss',
    pollIntervalSec: 300,
    notes: 'Via Google News site search.',
  },
  {
    name: 'gCaptain',
    url: 'https://gcaptain.com/',
    rssUrl: 'https://gcaptain.com/feed/',
    kind: 'rss',
    pollIntervalSec: 900,
    notes: 'Native WP feed.',
  },
  {
    name: 'Splash247',
    url: 'https://splash247.com/',
    rssUrl: 'https://splash247.com/feed/',
    kind: 'rss',
    pollIntervalSec: 900,
    notes: 'Native WP feed.',
  },
  {
    name: 'Hellenic Shipping News',
    url: 'https://www.hellenicshippingnews.com/',
    rssUrl: 'https://www.hellenicshippingnews.com/feed/',
    kind: 'rss',
    pollIntervalSec: 900,
    notes: 'Aggregator — high volume; expect duplicates with other sources.',
  },
  {
    name: 'TradeWinds (headlines)',
    url: 'https://www.tradewindsnews.com/',
    rssUrl: 'https://www.tradewindsnews.com/rss',
    kind: 'rss',
    pollIntervalSec: 1800,
    notes: 'Paywalled — only titles + short excerpts from RSS without a subscription.',
  },
  {
    name: "Lloyd's List (headlines)",
    url: 'https://www.lloydslist.com/',
    rssUrl: 'https://www.lloydslist.com/LL/rss',
    kind: 'rss',
    pollIntervalSec: 1800,
    notes: 'Paywalled — headline-only without subscription.',
  },
  {
    name: 'Bloomberg — Shipping',
    url: 'https://www.bloomberg.com/',
    rssUrl: 'https://news.google.com/rss/search?q=site%3Abloomberg.com+(shipping+OR+tanker+OR+crude)&hl=en-US&gl=US&ceid=US%3Aen',
    kind: 'rss',
    pollIntervalSec: 900,
    notes: 'Bloomberg has no public RSS; pulled via Google News site search.',
  },
  {
    name: 'EIA — Press Releases',
    url: 'https://www.eia.gov/pressroom/',
    rssUrl: 'https://www.eia.gov/rss/press_rss.xml',
    kind: 'rss',
    pollIntervalSec: 1800,
    notes: 'Weekly petroleum status, STEO, annual outlooks.',
  },
  {
    name: 'OPEC — Press Room',
    url: 'https://www.opec.org/opec_web/en/press_room/',
    rssUrl: 'https://www.opec.org/opec_web/en/press_room/28.htm',
    kind: 'scraper',
    pollIntervalSec: 3600,
    notes: 'No native feed; scraper parses the press room landing page.',
  },
] as const
