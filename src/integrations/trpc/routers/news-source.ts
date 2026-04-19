import { z } from 'zod'
import type { TRPCRouterRecord } from '@trpc/server'
import { prisma } from '#/server/db'
import { adminProcedure, publicProcedure } from '../init'

const kind = z.enum(['rss', 'scraper'])

export const newsSourceRouter = {
  list: publicProcedure.query(async () => {
    return prisma.newsSource.findMany({ orderBy: [{ name: 'asc' }] })
  }),

  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(200),
        url: z.string().url(),
        rssUrl: z.string().url().nullable(),
        kind,
        pollIntervalSec: z.number().int().min(60).max(86_400),
      }),
    )
    .mutation(async ({ input }) => {
      return prisma.newsSource.create({ data: input })
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.number().int(),
        name: z.string().min(1).max(200).optional(),
        url: z.string().url().optional(),
        rssUrl: z.string().url().nullable().optional(),
        kind: kind.optional(),
        pollIntervalSec: z.number().int().min(60).max(86_400).optional(),
        active: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input
      return prisma.newsSource.update({ where: { id }, data })
    }),
} satisfies TRPCRouterRecord
