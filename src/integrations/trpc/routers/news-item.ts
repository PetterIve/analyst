import { z } from 'zod'
import type { TRPCRouterRecord } from '@trpc/server'
import { prisma } from '#/server/db'
import { publicProcedure } from '../init'

export const newsItemRouter = {
  list: publicProcedure
    .input(
      z
        .object({
          sourceIds: z.array(z.number().int()).optional(),
          processed: z.enum(['any', 'processed', 'unprocessed']).default('any'),
          search: z.string().trim().optional(),
          limit: z.number().int().min(1).max(200).default(50),
          cursor: z.number().int().optional(),
        })
        .default({ processed: 'any', limit: 50 }),
    )
    .query(async ({ input }) => {
      const where = {
        ...(input.sourceIds?.length ? { sourceId: { in: input.sourceIds } } : {}),
        ...(input.processed === 'processed' ? { processedAt: { not: null } } : {}),
        ...(input.processed === 'unprocessed' ? { processedAt: null } : {}),
        ...(input.search ? { title: { contains: input.search, mode: 'insensitive' as const } } : {}),
      }
      const items = await prisma.newsItem.findMany({
        where,
        orderBy: [{ publishedAt: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }],
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        include: { source: { select: { id: true, name: true } } },
      })
      let nextCursor: number | null = null
      if (items.length > input.limit) {
        const next = items.pop()
        nextCursor = next?.id ?? null
      }
      return { items, nextCursor }
    }),
} satisfies TRPCRouterRecord
