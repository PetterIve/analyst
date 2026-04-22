import { TRPCError, type TRPCRouterRecord } from '@trpc/server'
import { z } from 'zod'
import { prisma } from '#/server/db'
import { adminProcedure, publicProcedure } from '../init'

const alertStateSchema = z.enum(['pending', 'delivered', 'held', 'cancelled'])
const directionSchema = z.enum(['long', 'short'])

export const alertRouter = {
  list: publicProcedure
    .input(
      z
        .object({
          state: alertStateSchema.optional(),
          direction: directionSchema.optional(),
          tickerSymbol: z.string().min(1).max(20).optional(),
          limit: z.number().int().min(1).max(200).default(50),
          cursor: z.number().int().optional(),
        })
        .default({ limit: 50 }),
    )
    .query(async ({ input }) => {
      const where = {
        ...(input.state ? { state: input.state } : {}),
        ...(input.direction ? { direction: input.direction } : {}),
        ...(input.tickerSymbol
          ? { ticker: { symbol: input.tickerSymbol.toUpperCase() } }
          : {}),
      }
      const rows = await prisma.alert.findMany({
        where,
        include: { ticker: { select: { symbol: true } } },
        orderBy: [{ firedAt: 'desc' }, { id: 'desc' }],
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      })
      let nextCursor: number | null = null
      if (rows.length > input.limit) {
        nextCursor = rows.pop()?.id ?? null
      }
      return {
        items: rows.map((a) => ({
          id: a.id,
          symbol: a.ticker.symbol,
          direction: a.direction,
          state: a.state,
          entryPrice: a.entryPrice,
          compositeScoreAtFire: a.compositeScoreAtFire,
          firedAt: a.firedAt,
          deliverAt: a.deliverAt,
          deliveredAt: a.deliveredAt,
          cancelReason: a.cancelReason,
          expectedReturn5d: a.expectedReturn5d,
          hitRate: a.hitRate,
          nComparables: a.nComparables,
        })),
        nextCursor,
      }
    }),

  byId: publicProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ input }) => {
      const alert = await prisma.alert.findUnique({
        where: { id: input.id },
        include: {
          ticker: { select: { symbol: true, name: true, exchange: true } },
          sources: {
            include: {
              newsItem: {
                select: {
                  id: true,
                  title: true,
                  url: true,
                  publishedAt: true,
                  source: { select: { name: true } },
                },
              },
              xPost: {
                select: {
                  id: true,
                  text: true,
                  postId: true,
                  postedAt: true,
                  account: { select: { handle: true } },
                },
              },
            },
          },
        },
      })
      if (!alert) {
        throw new TRPCError({ code: 'NOT_FOUND', message: `Unknown alert ${input.id}` })
      }
      return alert
    }),

  cancel: adminProcedure
    .input(z.object({ id: z.number().int(), reason: z.string().min(1).max(500) }))
    .mutation(async ({ input }) => {
      const alert = await prisma.alert.findUnique({
        where: { id: input.id },
        select: { state: true },
      })
      if (!alert) {
        throw new TRPCError({ code: 'NOT_FOUND', message: `Unknown alert ${input.id}` })
      }
      if (alert.state !== 'pending' && alert.state !== 'held') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot cancel an alert in state '${alert.state}'.`,
        })
      }
      return prisma.alert.update({
        where: { id: input.id },
        data: { state: 'cancelled', cancelReason: input.reason, deliverAt: null },
      })
    }),

  forceDeliver: adminProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const alert = await prisma.alert.findUnique({
        where: { id: input.id },
        select: { state: true },
      })
      if (!alert) {
        throw new TRPCError({ code: 'NOT_FOUND', message: `Unknown alert ${input.id}` })
      }
      if (alert.state !== 'held') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Only held alerts can be force-delivered (state='${alert.state}').`,
        })
      }
      return prisma.alert.update({
        where: { id: input.id },
        data: { state: 'pending', deliverAt: new Date() },
      })
    }),
} satisfies TRPCRouterRecord
