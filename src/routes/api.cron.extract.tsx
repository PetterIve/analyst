import { createFileRoute } from '@tanstack/react-router'
import { prisma } from '#/server/db'
import { logger } from '#/lib/logger.server'
import { runExtractor } from '#/server/ingest/extractor/run'

const JOB_NAME = 'extract'

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
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
    const result = await runExtractor({
      limit: 50,
      concurrency: 4,
      onItemEnd: (outcome) => {
        const base = {
          job: JOB_NAME,
          runId: run.id,
          sourceKind: outcome.sourceKind,
          sourceRefId: outcome.sourceRefId,
          candidateId: outcome.candidateId,
          eventClass: outcome.eventClassSlug,
          confidence: outcome.overallConfidence,
        }
        if (outcome.error) {
          logger.warn({ ...base, err: outcome.error }, 'extract item failed')
        } else if (outcome.eventClassSlug) {
          logger.info(base, 'extract item classified')
        } else {
          logger.debug(base, 'extract item irrelevant')
        }
      },
    })

    const durationMs = result.finishedAt.getTime() - startedAt.getTime()
    logger.info(
      {
        job: JOB_NAME,
        runId: run.id,
        items: result.itemsProcessed,
        candidates: result.candidatesWritten,
        errors: result.errors,
        usage: result.usage,
        costUsd: Number(result.cost.total.toFixed(6)),
        durationMs,
      },
      'cron finished',
    )

    await prisma.cronRun.update({
      where: { id: run.id },
      data: {
        finishedAt: result.finishedAt,
        status: result.errors > 0 ? 'error' : 'ok',
        errorMsg:
          result.errors > 0
            ? `${result.errors}/${result.itemsProcessed} items failed`
            : null,
        metrics: {
          model: result.model,
          itemsProcessed: result.itemsProcessed,
          candidatesWritten: result.candidatesWritten,
          errors: result.errors,
          usage: { ...result.usage },
          costUsd: Number(result.cost.total.toFixed(6)),
        } as object,
      },
    })

    return Response.json({
      ok: result.errors === 0,
      itemsProcessed: result.itemsProcessed,
      candidatesWritten: result.candidatesWritten,
      errors: result.errors,
      costUsd: result.cost.total,
      cacheReadTokens: result.usage.cacheReadInputTokens,
      cacheWriteTokens: result.usage.cacheCreationInputTokens,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error({ job: JOB_NAME, runId: run.id, err: message }, 'cron failed')
    await prisma.cronRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), status: 'error', errorMsg: message },
    })
    return new Response(`Extract failed: ${message}`, { status: 500 })
  }
}

export const Route = createFileRoute('/api/cron/extract')({
  server: {
    handlers: {
      GET: handler,
      POST: handler,
    },
  },
})
