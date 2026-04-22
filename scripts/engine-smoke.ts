import { prisma } from '../src/server/db.ts'
import { engineTick } from '../src/lib/engine/tick.ts'

const [tc, fc, pending, alerts] = await Promise.all([
  prisma.ticker.count(),
  prisma.factorDefinition.count(),
  prisma.eventCandidate.count({ where: { consumedAt: null } }),
  prisma.alert.count(),
])
console.log('DB state:', { tickers: tc, factors: fc, pendingCandidates: pending, alerts })

const result = await engineTick(prisma)
console.log('Tick result:', JSON.stringify(result, null, 2))

await prisma.$disconnect()
