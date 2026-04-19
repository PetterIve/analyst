import { createFileRoute } from '@tanstack/react-router'
import { withCronRun } from '#/lib/obs/cron.server'
import { runNewsIngest } from '#/server/ingest/news/ingest'

const JOB_NAME = 'ingest-news'

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  // In local dev without a secret configured, allow unauthenticated calls so
  // the UI "Run now" button works. Staging / production must set CRON_SECRET.
  if (!secret) return process.env.NODE_ENV !== 'production'
  const header = request.headers.get('authorization')
  return header === `Bearer ${secret}`
}

async function handler({ request }: { request: Request }) {
  if (!authorized(request)) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const payload = await withCronRun(JOB_NAME, async ({ runId, log }) => {
      const result = await runNewsIngest({
        onSourceStart: (source) =>
          log.debug(
            { sourceId: source.id, source: source.name },
            'source fetch starting',
          ),
        onSourceEnd: (outcome) => {
          const base = {
            sourceId: outcome.sourceId,
            source: outcome.name,
            fetched: outcome.fetched,
            inserted: outcome.inserted,
            skipped: outcome.skipped,
          }
          if (outcome.error) {
            log.warn({ ...base, err: outcome.error }, 'source fetch failed')
          } else if (outcome.skipped) {
            log.debug(base, 'source skipped (poll window)')
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
          ok: errors === 0,
          totalInserted: result.totalInserted,
          perSource: result.perSource,
          runId,
        },
        status,
        errorMsg,
        metrics: {
          totalInserted: result.totalInserted,
          perSource: result.perSource,
        },
      }
    })

    return Response.json(payload)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return new Response(`Ingest failed: ${message}`, { status: 500 })
  }
}

export const Route = createFileRoute('/api/cron/ingest-news')({
  server: {
    handlers: {
      GET: handler,
      POST: handler,
    },
  },
})
