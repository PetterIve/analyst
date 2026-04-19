import type { PrismaClient } from '#/generated/prisma/client'
import { computeEventReturns } from '../lib/compute-returns'
import { eventClassSeeds } from './classes'
import { eventInstanceSeeds } from './instances'

/**
 * Idempotently insert the event-class taxonomy. Existing rows (matched by
 * `slug`) are left untouched so operator edits via `/admin/events` survive
 * reseeds. Returns counts for the orchestrator's log line.
 */
export async function applyEventClassSeeds(prisma: PrismaClient): Promise<{
  created: number
  existing: number
}> {
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
  return { created, existing: eventClassSeeds.length - created }
}

/**
 * Idempotently insert the hand-seeded historical event instances and compute
 * forward returns for each from `prices_daily`. Idempotency key is
 * `(class, occurredAt, description)` since we don't have a unique constraint.
 *
 * `computed` is the number of new instances where at least one ticker had
 * forward price data — useful for spotting "ran seed before backfilling
 * prices" mistakes (computed/created should approach 1.0).
 */
export async function applyEventInstanceSeeds(prisma: PrismaClient): Promise<{
  created: number
  existing: number
  skippedNoClass: number
  computed: number
}> {
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
  return {
    created,
    existing: eventInstanceSeeds.length - created - skippedNoClass,
    skippedNoClass,
    computed,
  }
}
