import type { TRPCRouterRecord } from '@trpc/server'
import { z } from 'zod'
import { prisma } from '#/server/db'
import { publicProcedure } from '../init'

export const factorHistoryRouter = {
  recent: publicProcedure
    .input(z.object({ limit: z.number().int().min(1).max(200).default(50) }).default({ limit: 50 }))
    .query(async ({ input }) => {
      const rows = await prisma.factorStateHistory.findMany({
        orderBy: { createdAt: 'desc' },
        take: input.limit,
        include: {
          ticker: { select: { symbol: true } },
          factor: { select: { slug: true } },
        },
      })
      return rows.map((r) => ({
        id: r.id,
        symbol: r.ticker.symbol,
        factorSlug: r.factor.slug,
        oldValue: r.oldValue,
        newValue: r.newValue,
        delta: r.delta,
        reason: r.reason,
        createdAt: r.createdAt,
      }))
    }),
} satisfies TRPCRouterRecord
