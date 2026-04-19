import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client.js'
import { tickerSeeds } from '../src/server/seed/tickers.js'
import { factorSeeds } from '../src/server/seed/factors.js'
import { factorInitialByTicker } from '../src/server/seed/factor-initial-state.js'
import { newsSourceSeeds } from '../src/server/seed/news-sources.js'
import { eventClassSeeds } from '../src/server/seed/event-classes.js'
import { eventInstanceSeeds } from '../src/server/seed/event-instances.js'
import { computeEventReturns } from '../src/lib/events/compute-returns.js'

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
})

const prisma = new PrismaClient({ adapter })

// Seed is "add missing rows only" — it never overwrites existing rows, so operator
// edits via /admin/* and engine-driven factor state mutations survive reseeds.
// To force seed values, wipe the table first (e.g. `prisma migrate reset`).

async function seedTickers() {
  let created = 0
  for (const t of tickerSeeds) {
    const existing = await prisma.ticker.findUnique({
      where: { symbol: t.symbol },
      select: { id: true },
    })
    if (existing) continue
    await prisma.ticker.create({
      data: {
        symbol: t.symbol,
        exchange: t.exchange,
        segment: t.segment,
        name: t.name,
      },
    })
    created++
  }
  console.log(`  tickers: ${created} created, ${tickerSeeds.length - created} existing`)
}

async function seedFactors() {
  let created = 0
  for (const f of factorSeeds) {
    const existing = await prisma.factorDefinition.findUnique({
      where: { slug: f.slug },
      select: { id: true },
    })
    if (existing) continue
    await prisma.factorDefinition.create({ data: f })
    created++
  }
  console.log(`  factors: ${created} created, ${factorSeeds.length - created} existing`)
}

async function seedFactorState() {
  const tickers = await prisma.ticker.findMany()
  const factors = await prisma.factorDefinition.findMany()
  let created = 0
  let existing = 0
  for (const ticker of tickers) {
    const overrides = factorInitialByTicker[ticker.symbol] ?? {}
    for (const factor of factors) {
      const already = await prisma.factorState.findUnique({
        where: {
          tickerId_factorId: { tickerId: ticker.id, factorId: factor.id },
        },
        select: { id: true },
      })
      if (already) {
        existing++
        continue
      }
      const value = overrides[factor.slug] ?? factor.defaultValue
      await prisma.factorState.create({
        data: { tickerId: ticker.id, factorId: factor.id, value },
      })
      created++
    }
  }
  console.log(
    `  factor_state: ${created} created, ${existing} existing (${tickers.length} tickers × ${factors.length} factors)`,
  )
}

async function seedNewsSources() {
  let created = 0
  for (const s of newsSourceSeeds) {
    const existing = await prisma.newsSource.findFirst({
      where: { url: s.url },
      select: { id: true },
    })
    if (existing) continue
    await prisma.newsSource.create({
      data: {
        name: s.name,
        url: s.url,
        rssUrl: s.rssUrl,
        kind: s.kind,
        pollIntervalSec: s.pollIntervalSec,
      },
    })
    created++
  }
  console.log(`  news_sources: ${created} created, ${newsSourceSeeds.length - created} existing`)
}

async function seedXAccounts() {
  // Populated in T05 — curated X account list.
}

async function seedEventClasses() {
  let created = 0
  for (const cls of eventClassSeeds) {
    const existing = await prisma.eventClass.findUnique({
      where: { slug: cls.slug },
      select: { id: true },
    })
    if (existing) continue
    await prisma.eventClass.create({
      data: {
        slug: cls.slug,
        name: cls.name,
        description: cls.description,
        defaultFactorDeltas: cls.defaultFactorDeltas,
      },
    })
    created++
  }
  console.log(
    `  event_classes: ${created} created, ${eventClassSeeds.length - created} existing`,
  )
}

async function seedEventInstances() {
  // Build slug → id lookup once.
  const classes = await prisma.eventClass.findMany({ select: { id: true, slug: true } })
  const classIdBySlug = new Map(classes.map((c) => [c.slug, c.id]))

  let created = 0
  let skippedNoClass = 0
  let computed = 0
  for (const seed of eventInstanceSeeds) {
    const classId = classIdBySlug.get(seed.eventClassSlug)
    if (!classId) {
      skippedNoClass++
      continue
    }
    const occurredAt = new Date(`${seed.occurredAt}T00:00:00Z`)
    // Idempotency key: same class + same date + same description = same instance.
    // We don't have a unique index, so check manually.
    const existing = await prisma.eventInstance.findFirst({
      where: {
        eventClassId: classId,
        occurredAt,
        description: seed.description,
      },
      select: { id: true },
    })
    if (existing) continue

    const tickerReturns = await computeEventReturns(
      prisma,
      occurredAt,
      seed.affectedSymbols,
    )
    if (Object.values(tickerReturns).some((r) => r.d1 !== null)) computed++

    await prisma.eventInstance.create({
      data: {
        eventClassId: classId,
        occurredAt,
        description: seed.description,
        sourceKind: 'manual',
        sourceUrl: seed.sourceUrl,
        affectedSymbols: [...seed.affectedSymbols],
        tickerReturns: tickerReturns as unknown as object,
      },
    })
    created++
  }
  console.log(
    `  event_instances: ${created} created, ${eventInstanceSeeds.length - created - skippedNoClass} existing, ${skippedNoClass} skipped (unknown class), ${computed}/${created} with price data`,
  )
}

async function main() {
  console.log('Seeding database...')
  await seedTickers()
  await seedFactors()
  await seedFactorState()
  await seedNewsSources()
  await seedXAccounts()
  await seedEventClasses()
  await seedEventInstances()
  console.log('Seed complete.')
}

main()
  .catch((error) => {
    console.error('Seed failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
