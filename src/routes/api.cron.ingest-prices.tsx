import { createFileRoute } from '@tanstack/react-router'
import { prisma } from '#/server/db'
import { logger } from '#/lib/logger.server'
import { backfillTicker } from '#/lib/ingest/prices/backfill'

const JOB_NAME = 'ingest-prices'

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

  const run = await prisma.cronRun.create({
    data: {
      jobName: JOB_NAME,
      startedAt: new Date(),
      status: 'ok',
    },
  })

  try {
    const tickers = await prisma.ticker.findMany({
      where: { active: true },
      orderBy: { symbol: 'asc' },
      select: { id: true, symbol: true },
    })

    const results = []
    for (const t of tickers) {
      const r = await backfillTicker(t.id, { yearsBack: 1 })
      results.push(r)
    }

    const errors = results.filter((r) => r.error).length
    const inserted = results.reduce((n, r) => n + r.rowsInserted, 0)

    await prisma.cronRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        status: errors > 0 ? 'error' : 'ok',
        errorMsg:
          errors > 0
            ? `${errors}/${results.length} tickers failed`
            : null,
        metrics: {
          tickers: results.length,
          errors,
          rowsInserted: inserted,
        },
      },
    })

    return Response.json({
      ok: errors === 0,
      tickers: results.length,
      errors,
      rowsInserted: inserted,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error({ err: msg }, 'ingest-prices cron failed')
    await prisma.cronRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        status: 'error',
        errorMsg: msg,
      },
    })
    return new Response(msg, { status: 500 })
  }
}

export const Route = createFileRoute('/api/cron/ingest-prices')({
  server: {
    handlers: {
      GET: handler,
      POST: handler,
    },
  },
})
