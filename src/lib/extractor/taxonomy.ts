import { prisma } from '#/server/db'

export interface TickerTaxonomyRow {
  symbol: string
  name: string
  segment: string
}

export interface FactorTaxonomyRow {
  slug: string
  name: string
  description: string | null
  rangeMin: number
  rangeMax: number
}

export interface EventClassTaxonomyRow {
  slug: string
  name: string
  description: string | null
  defaultFactorDeltas: Record<string, number>
}

export interface Taxonomy {
  tickers: ReadonlyArray<TickerTaxonomyRow>
  factors: ReadonlyArray<FactorTaxonomyRow>
  eventClasses: ReadonlyArray<EventClassTaxonomyRow>
}

export async function loadTaxonomy(): Promise<Taxonomy> {
  const [tickers, factors, eventClasses] = await Promise.all([
    prisma.ticker.findMany({
      where: { active: true },
      orderBy: { symbol: 'asc' },
      select: { symbol: true, name: true, segment: true },
    }),
    prisma.factorDefinition.findMany({
      orderBy: { slug: 'asc' },
      select: {
        slug: true,
        name: true,
        description: true,
        rangeMin: true,
        rangeMax: true,
      },
    }),
    prisma.eventClass.findMany({
      orderBy: { slug: 'asc' },
      select: {
        slug: true,
        name: true,
        description: true,
        defaultFactorDeltas: true,
      },
    }),
  ])

  return {
    tickers: tickers.map((t) => ({
      symbol: t.symbol,
      name: t.name,
      segment: String(t.segment),
    })),
    factors,
    eventClasses: eventClasses.map((c) => ({
      slug: c.slug,
      name: c.name,
      description: c.description,
      defaultFactorDeltas: normalizeDeltas(c.defaultFactorDeltas),
    })),
  }
}

function normalizeDeltas(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v
  }
  return out
}
