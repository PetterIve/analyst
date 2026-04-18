import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client.js'
import { tickerSeeds } from '../src/server/seed/tickers.js'
import { factorSeeds } from '../src/server/seed/factors.js'
import { factorInitialByTicker } from '../src/server/seed/factor-initial-state.js'

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
  // Populated in T04 — RSS source list.
}

async function seedXAccounts() {
  // Populated in T05 — curated X account list.
}

async function seedEventClasses() {
  // Populated in T08 — event catalog bootstrap.
}

async function main() {
  console.log('Seeding database...')
  await seedTickers()
  await seedFactors()
  await seedFactorState()
  await seedNewsSources()
  await seedXAccounts()
  await seedEventClasses()
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
