import type { TRPCRouterRecord } from '@trpc/server'
import { runNewsIngest } from '#/server/ingest/news/ingest'
import { withCronRun } from '#/lib/obs/cron.server'
import { adminProcedure } from '../init'

const NEWS_JOB = 'ingest-news'

export const cronRouter = {
  // Admin "Run now" button on /admin/sources — bypasses pollIntervalSec.
  runIngestNews: adminProcedure.mutation(async () => {
    return withCronRun(
      NEWS_JOB,
      async ({ log }) => {
        const result = await runNewsIngest({
          force: true,
          onSourceEnd: (outcome) => {
            const base = {
              sourceId: outcome.sourceId,
              source: outcome.name,
              fetched: outcome.fetched,
              inserted: outcome.inserted,
            }
            if (outcome.error) {
              log.warn({ ...base, err: outcome.error }, 'source fetch failed')
            } else {
              log.info(base, 'source fetch ok')
            }
          },
        })

        const errors = result.perSource.filter((r) => r.error).length
        const status = errors > 0 ? 'error' : 'ok'
        const errorMsg =
          errors > 0 ? `${errors}/${result.perSource.length} sources failed` : null

        return {
          result: {
            totalInserted: result.totalInserted,
            perSource: result.perSource,
          },
          status,
          errorMsg,
          metrics: {
            totalInserted: result.totalInserted,
            perSource: result.perSource,
          },
        }
      },
      { trigger: 'admin' },
    )
  }),
} satisfies TRPCRouterRecord
