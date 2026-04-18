import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client.js'

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
})

const prisma = new PrismaClient({ adapter })

async function seedTickers() {
  // Populated in T03 — ticker universe definition.
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

async function seedFactorDefinitions() {
  // Populated in T03 — factor taxonomy.
}

async function main() {
  console.log('Seeding database...')
  await seedTickers()
  await seedNewsSources()
  await seedXAccounts()
  await seedEventClasses()
  await seedFactorDefinitions()
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
