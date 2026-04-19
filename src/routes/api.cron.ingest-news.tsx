import { createFileRoute } from '@tanstack/react-router'
import { prisma } from '#/server/db'
import { logger } from '#/lib/logger.server'
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

  const startedAt = new Date()
  const run = await prisma.cronRun.create({
    data: { jobName: JOB_NAME, startedAt, status: 'ok' },
  })
  logger.info({ job: JOB_NAME, runId: run.id }, 'cron starting')

  try {
    const result = await runNewsIngest({
      onSourceStart: (source) =>
        logger.debug(
          { job: JOB_NAME, runId: run.id, sourceId: source.id, source: source.name },
          'source fetch starting',
        ),
      onSourceEnd: (outcome) => {
        const base = {
          job: JOB_NAME,
          runId: run.id,
          sourceId: outcome.sourceId,
          source: outcome.name,
          fetched: outcome.fetched,
          inserted: outcome.inserted,
          skipped: outcome.skipped,
        }
        if (outcome.error) {
          logger.warn({ ...base, err: outcome.error }, 'source fetch failed')
        } else if (outcome.skipped) {
          logger.debug(base, 'source skipped (poll window)')
        } else {
          logger.info(base, 'source fetch ok')
        }
      },
    })

    const errors = result.perSource.filter((r) => r.error).length
    const durationMs = result.finishedAt.getTime() - startedAt.getTime()
    logger.info(
      {
        job: JOB_NAME,
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

    return Response.json({
      ok: errors === 0,
      totalInserted: result.totalInserted,
      perSource: result.perSource,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error({ job: JOB_NAME, runId: run.id, err: message }, 'cron failed')
    await prisma.cronRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), status: 'error', errorMsg: message },
    })
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
