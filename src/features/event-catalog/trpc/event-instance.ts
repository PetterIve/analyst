import { TRPCError, type TRPCRouterRecord } from '@trpc/server'
import { z } from 'zod'
import { prisma } from '#/server/db'
import { publicProcedure } from '#/integrations/trpc/init'
import { computeEventReturns } from '../lib/compute-returns'

const symbolSchema = z.string().min(1).max(20)

export const eventInstanceRouter = {
  list: publicProcedure
    .input(
      z.object({
        classSlug: z.string().min(1).max(100).optional(),
        limit: z.number().int().min(1).max(500).default(100),
      }),
    )
    .query(async ({ input }) => {
      const where = input.classSlug
        ? { eventClass: { slug: input.classSlug } }
        : undefined
      const instances = await prisma.eventInstance.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        take: input.limit,
        include: {
          eventClass: { select: { slug: true, name: true } },
        },
      })
      return instances.map((i) => ({
        id: i.id,
        occurredAt: i.occurredAt,
        description: i.description,
        sourceUrl: i.sourceUrl,
        sourceKind: i.sourceKind,
        eventClassSlug: i.eventClass.slug,
        eventClassName: i.eventClass.name,
        affectedSymbols: Array.isArray(i.affectedSymbols)
          ? (i.affectedSymbols as unknown[]).filter((v): v is string => typeof v === 'string')
          : [],
      }))
    }),

  // TODO(auth): Tighten to adminProcedure once Clerk is wired in dev.
  create: publicProcedure
    .input(
      z.object({
        classSlug: z.string().min(1).max(100),
        occurredAt: z.date(),
        description: z.string().min(3).max(500),
        sourceUrl: z.string().url().max(500).optional(),
        affectedSymbols: z.array(symbolSchema).min(1).max(50),
      }),
    )
    .mutation(async ({ input }) => {
      const cls = await prisma.eventClass.findUnique({
        where: { slug: input.classSlug },
        select: { id: true },
      })
      if (!cls) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Unknown class: ${input.classSlug}`,
        })
      }
      const tickerReturns = await computeEventReturns(
        prisma,
        input.occurredAt,
        input.affectedSymbols,
      )
      const created = await prisma.eventInstance.create({
        data: {
          eventClassId: cls.id,
          occurredAt: input.occurredAt,
          description: input.description,
          sourceKind: 'manual',
          sourceUrl: input.sourceUrl ?? null,
          affectedSymbols: input.affectedSymbols,
          tickerReturns: tickerReturns as unknown as object,
        },
      })
      return { id: created.id }
    }),
} satisfies TRPCRouterRecord
