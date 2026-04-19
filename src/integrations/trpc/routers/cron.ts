import type { TRPCRouterRecord } from '@trpc/server'
import { runNewsIngest } from '#/server/ingest/news/ingest'
import { prisma } from '#/server/db'
import { adminProcedure } from '../init'

const NEWS_JOB = 'ingest-news'

export const cronRouter = {
  // Admin "Run now" button on /admin/sources — bypasses pollIntervalSec.
  runIngestNews: adminProcedure.mutation(async () => {
    const cronRun = await prisma.cronRun.create({
      data: { jobName: NEWS_JOB, startedAt: new Date(), status: 'ok' },
    })
    try {
      const result = await runNewsIngest({ force: true })
      await prisma.cronRun.update({
        where: { id: cronRun.id },
        data: {
          finishedAt: result.finishedAt,
          status: 'ok',
          metrics: {
            totalInserted: result.totalInserted,
            perSource: result.perSource,
          },
        },
      })
      return {
        totalInserted: result.totalInserted,
        perSource: result.perSource,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      await prisma.cronRun.update({
        where: { id: cronRun.id },
        data: { finishedAt: new Date(), status: 'error', errorMsg: message },
      })
      throw err
    }
  }),
} satisfies TRPCRouterRecord
