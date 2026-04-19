import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client.js'
import { tickerSeeds } from '../src/server/seed/tickers.js'
import { factorSeeds } from '../src/server/seed/factors.js'
import { factorInitialByTicker } from '../src/server/seed/factor-initial-state.js'
import { newsSourceSeeds } from '../src/server/seed/news-sources.js'
import {
  applyEventClassSeeds,
  applyEventInstanceSeeds,
} from '../src/features/event-catalog/index.js'

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
  const { created, existing } = await applyEventClassSeeds(prisma)
  console.log(`  event_classes: ${created} created, ${existing} existing`)
}

async function seedEventInstances() {
  const { created, existing, skippedNoClass, computed } =
    await applyEventInstanceSeeds(prisma)
  console.log(
    `  event_instances: ${created} created, ${existing} existing, ${skippedNoClass} skipped (unknown class), ${computed}/${created} with price data`,
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
