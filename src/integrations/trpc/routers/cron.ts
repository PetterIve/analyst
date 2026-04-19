import type { TRPCRouterRecord } from '@trpc/server'
import { runNewsIngest } from '#/server/ingest/news/ingest'
import { prisma } from '#/server/db'
import { logger } from '#/lib/logger.server'
import { adminProcedure } from '../init'

const NEWS_JOB = 'ingest-news'

export const cronRouter = {
  // Admin "Run now" button on /admin/sources — bypasses pollIntervalSec.
  runIngestNews: adminProcedure.mutation(async () => {
    const startedAt = new Date()
    const run = await prisma.cronRun.create({
      data: { jobName: NEWS_JOB, startedAt, status: 'ok' },
    })
    logger.info({ job: NEWS_JOB, runId: run.id, trigger: 'admin' }, 'cron starting')

    try {
      const result = await runNewsIngest({
        force: true,
        onSourceEnd: (outcome) => {
          const base = {
            job: NEWS_JOB,
            runId: run.id,
            sourceId: outcome.sourceId,
            source: outcome.name,
            fetched: outcome.fetched,
            inserted: outcome.inserted,
          }
          if (outcome.error) {
            logger.warn({ ...base, err: outcome.error }, 'source fetch failed')
          } else {
            logger.info(base, 'source fetch ok')
          }
        },
      })

      const errors = result.perSource.filter((r) => r.error).length
      const durationMs = result.finishedAt.getTime() - startedAt.getTime()
      logger.info(
        {
          job: NEWS_JOB,
          runId: run.id,
          sources: result.perSource.length,
          errors,
          rowsInserted: result.totalInserted,
          durationMs,
        },
        'cron finished',
      )

      await prisma.cronRun.update({
        where: { id: run.id },
        data: {
          finishedAt: result.finishedAt,
          status: errors > 0 ? 'error' : 'ok',
          errorMsg:
            errors > 0 ? `${errors}/${result.perSource.length} sources failed` : null,
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
      logger.error({ job: NEWS_JOB, runId: run.id, err: message }, 'cron failed')
      await prisma.cronRun.update({
        where: { id: run.id },
        data: { finishedAt: new Date(), status: 'error', errorMsg: message },
      })
      throw err
    }
  }),
} satisfies TRPCRouterRecord
