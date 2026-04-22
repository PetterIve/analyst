import { createFileRoute } from '@tanstack/react-router'
import { prisma } from '#/server/db'
import { logger } from '#/lib/logger.server'
import { engineTick } from '#/lib/engine/tick'

const JOB_NAME = 'engine-tick'

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
    const result = await engineTick(prisma)
    const durationMs = result.finishedAt.getTime() - startedAt.getTime()

    logger.info(
      {
        job: JOB_NAME,
        runId: run.id,
        decayMutations: result.decayMutations,
        candidatesApplied: result.apply.applied,
        candidatesSkipped: result.apply.skipped,
        factorMutations: result.apply.mutations,
        proposals: result.proposalsEvaluated,
        alertsCreated: result.alertsCreated,
        alertsHeld: result.alertsHeld,
        alertsPending: result.alertsPending,
        durationMs,
      },
      'cron finished',
    )

    await prisma.cronRun.update({
      where: { id: run.id },
      data: {
        finishedAt: result.finishedAt,
        status: 'ok',
        metrics: {
          decayMutations: result.decayMutations,
          candidatesApplied: result.apply.applied,
          candidatesSkipped: result.apply.skipped,
          factorMutations: result.apply.mutations,
          proposalsEvaluated: result.proposalsEvaluated,
          alertsCreated: result.alertsCreated,
          alertsHeld: result.alertsHeld,
          alertsPending: result.alertsPending,
        } as object,
      },
    })

    return Response.json({
      ok: true,
      alertsCreated: result.alertsCreated,
      alertsHeld: result.alertsHeld,
      alertsPending: result.alertsPending,
      candidatesApplied: result.apply.applied,
      factorMutations: result.apply.mutations,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error({ job: JOB_NAME, runId: run.id, err: message }, 'cron failed')
    await prisma.cronRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), status: 'error', errorMsg: message },
    })
    return new Response(`engine-tick failed: ${message}`, { status: 500 })
  }
}

export const Route = createFileRoute('/api/cron/engine-tick')({
  server: {
    handlers: {
      GET: handler,
      POST: handler,
    },
  },
})
