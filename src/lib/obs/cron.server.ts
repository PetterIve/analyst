import type { Logger } from 'pino'
import { prisma } from '#/server/db'
import { logger } from '#/lib/logger.server'
import { sendCronError } from '#/features/telegram/send-error'

export interface CronRunContext {
  runId: number
  jobName: string
  startedAt: Date
  log: Logger
}

export interface CronRunResult<T> {
  result: T
  metrics?: unknown
  status?: 'ok' | 'error'
  errorMsg?: string | null
}

export interface WithCronRunOptions {
  trigger?: 'cron' | 'admin'
}

/**
 * Wrap a cron body with the shared CronRun lifecycle: insert the start row,
 * run `fn`, write finishedAt + status + metrics, and — on throw — record the
 * error and notify the error-channel Telegram chat before rethrowing. The
 * caller decides what HTTP response (or tRPC throw) to surface.
 *
 * `fn` may return `status: 'error'` with a message to mark a partial failure
 * (e.g. 2/10 sources failed) without throwing.
 */
export async function withCronRun<T>(
  jobName: string,
  fn: (ctx: CronRunContext) => Promise<CronRunResult<T>>,
  opts: WithCronRunOptions = {},
): Promise<T> {
  const startedAt = new Date()
  const run = await prisma.cronRun.create({
    data: { jobName, startedAt, status: 'ok' },
  })
  const log = logger.child({ job: jobName, runId: run.id, trigger: opts.trigger ?? 'cron' })
  log.info('cron starting')

  try {
    const outcome = await fn({ runId: run.id, jobName, startedAt, log })
    const finishedAt = new Date()
    const status = outcome.status ?? 'ok'
    const errorMsg = outcome.errorMsg ?? null
    const durationMs = finishedAt.getTime() - startedAt.getTime()

    log.info({ durationMs, status, metrics: outcome.metrics }, 'cron finished')

    await prisma.cronRun.update({
      where: { id: run.id },
      data: {
        finishedAt,
        status,
        errorMsg,
        metrics: (outcome.metrics ?? null) as never,
      },
    })

    if (status === 'error') {
      // Partial failure — fire to the error channel so it doesn't get lost.
      await sendCronError({
        jobName,
        runId: run.id,
        message: errorMsg ?? 'cron reported error status',
      })
    }

    return outcome.result
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log.error({ err: message }, 'cron failed')
    await prisma.cronRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), status: 'error', errorMsg: message },
    })
    await sendCronError({ jobName, runId: run.id, message })
    throw err
  }
}
