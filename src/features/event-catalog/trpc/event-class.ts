import { TRPCError, type TRPCRouterRecord } from '@trpc/server'
import { z } from 'zod'
import { prisma } from '#/server/db'
import { adminProcedure, publicProcedure } from '#/integrations/trpc/init'
import { recomputeAllEventReturns } from '../lib/compute-returns'
import { eventClassStats, parseTickerReturns } from '../lib/stats'

export const eventClassRouter = {
  list: publicProcedure.query(async () => {
    const classes = await prisma.eventClass.findMany({
      orderBy: { slug: 'asc' },
      include: {
        instances: {
          select: { tickerReturns: true },
        },
      },
    })
    return classes.map((cls) => {
      const stats = eventClassStats(
        cls.instances.map((i) => ({ tickerReturns: parseTickerReturns(i.tickerReturns) })),
      )
      return {
        id: cls.id,
        slug: cls.slug,
        name: cls.name,
        description: cls.description,
        defaultFactorDeltas: cls.defaultFactorDeltas,
        instanceCount: stats.instanceCount,
        observationCount: stats.observationCount,
        meanD5: stats.d5?.mean ?? null,
        medianD5: stats.d5?.median ?? null,
        stddevD5: stats.d5?.stddev ?? null,
        hitRateD5: stats.d5?.hitRate ?? null,
      }
    })
  }),

  get: publicProcedure
    .input(z.object({ slug: z.string().min(1).max(100) }))
    .query(async ({ input }) => {
      const cls = await prisma.eventClass.findUnique({
        where: { slug: input.slug },
        include: {
          instances: {
            orderBy: { occurredAt: 'desc' },
          },
        },
      })
      if (!cls) {
        throw new TRPCError({ code: 'NOT_FOUND', message: `Unknown class: ${input.slug}` })
      }
      const instancesParsed = cls.instances.map((i) => ({
        id: i.id,
        occurredAt: i.occurredAt,
        description: i.description,
        sourceUrl: i.sourceUrl,
        sourceKind: i.sourceKind,
        affectedSymbols: Array.isArray(i.affectedSymbols)
          ? (i.affectedSymbols as unknown[]).filter((v): v is string => typeof v === 'string')
          : [],
        tickerReturns: parseTickerReturns(i.tickerReturns),
      }))
      const stats = eventClassStats(
        instancesParsed.map((i) => ({ tickerReturns: i.tickerReturns })),
      )
      return {
        id: cls.id,
        slug: cls.slug,
        name: cls.name,
        description: cls.description,
        defaultFactorDeltas: cls.defaultFactorDeltas,
        stats,
        instances: instancesParsed,
      }
    }),

  recomputeReturns: adminProcedure
    .input(z.object({ slug: z.string().min(1).max(100).optional() }))
    .mutation(async ({ input }) => {
      let eventClassId: number | undefined
      if (input.slug) {
        const cls = await prisma.eventClass.findUnique({
          where: { slug: input.slug },
          select: { id: true },
        })
        if (!cls) {
          throw new TRPCError({ code: 'NOT_FOUND', message: `Unknown class: ${input.slug}` })
        }
        eventClassId = cls.id
      }
      return recomputeAllEventReturns(prisma, { eventClassId })
    }),
} satisfies TRPCRouterRecord
