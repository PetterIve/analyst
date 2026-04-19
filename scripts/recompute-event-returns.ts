import { prisma } from '#/server/db'
import { recomputeAllEventReturns } from '#/lib/events/compute-returns'

async function main() {
  const started = Date.now()
  const result = await recomputeAllEventReturns(prisma)
  const elapsed = ((Date.now() - started) / 1000).toFixed(1)
  console.log(`Recomputed in ${elapsed}s`)
  console.log(`  updated: ${result.updated}`)
  console.log(`  skipped: ${result.skipped}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
