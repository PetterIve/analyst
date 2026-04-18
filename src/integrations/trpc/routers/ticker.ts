import { z } from 'zod'
import type { TRPCRouterRecord } from '@trpc/server'
import { prisma } from '#/server/db'
import { publicProcedure } from '../init'

export const tickerRouter = {
  list: publicProcedure.query(async () => {
    return prisma.ticker.findMany({
      orderBy: [{ segment: 'asc' }, { symbol: 'asc' }],
    })
  }),

  update: publicProcedure
    .input(
      z.object({
        id: z.number().int(),
        name: z.string().min(1).max(200).optional(),
        active: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input
      return prisma.ticker.update({ where: { id }, data })
    }),
} satisfies TRPCRouterRecord
