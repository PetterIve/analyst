import { z } from 'zod'
import type { TRPCRouterRecord } from '@trpc/server'
import { prisma } from '#/server/db'
import { publicProcedure } from '../init'

export const factorRouter = {
  list: publicProcedure.query(async () => {
    return prisma.factorDefinition.findMany({ orderBy: { slug: 'asc' } })
  }),

  update: publicProcedure
    .input(
      z.object({
        id: z.number().int(),
        weight: z.number().finite().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input
      return prisma.factorDefinition.update({ where: { id }, data })
    }),
} satisfies TRPCRouterRecord
