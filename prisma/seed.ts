import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client.js'
import { tickerSeeds } from '../src/server/seed/tickers.js'
import { factorSeeds } from '../src/server/seed/factors.js'
import { factorInitialByTicker } from '../src/server/seed/factor-initial-state.js'

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
})

const prisma = new PrismaClient({ adapter })

async function seedTickers() {
  for (const t of tickerSeeds) {
    await prisma.ticker.upsert({
      where: { symbol: t.symbol },
      update: {
        exchange: t.exchange,
        segment: t.segment,
        name: t.name,
      },
      create: {
        symbol: t.symbol,
        exchange: t.exchange,
        segment: t.segment,
        name: t.name,
      },
    })
  }
  console.log(`  tickers: ${tickerSeeds.length} upserted`)
}

async function seedFactors() {
  for (const f of factorSeeds) {
    await prisma.factorDefinition.upsert({
      where: { slug: f.slug },
      update: {
        name: f.name,
        description: f.description,
        rangeMin: f.rangeMin,
        rangeMax: f.rangeMax,
        defaultValue: f.defaultValue,
        weight: f.weight,
      },
      create: f,
    })
  }
  console.log(`  factors: ${factorSeeds.length} upserted`)
}

async function seedFactorState() {
  const tickers = await prisma.ticker.findMany()
  const factors = await prisma.factorDefinition.findMany()
  let count = 0
  for (const ticker of tickers) {
    const overrides = factorInitialByTicker[ticker.symbol] ?? {}
    for (const factor of factors) {
      const value = overrides[factor.slug] ?? factor.defaultValue
      await prisma.factorState.upsert({
        where: {
          tickerId_factorId: { tickerId: ticker.id, factorId: factor.id },
        },
        update: { value },
        create: { tickerId: ticker.id, factorId: factor.id, value },
      })
      count++
    }
  }
  console.log(`  factor_state: ${count} rows (${tickers.length} tickers × ${factors.length} factors)`)
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
