import { createFileRoute } from '@tanstack/react-router'
import { prisma } from '#/server/db'
import { withCronRun } from '#/lib/obs/cron.server'
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

  try {
    const payload = await withCronRun(JOB_NAME, async ({ log }) => {
      const tickers = await prisma.ticker.findMany({
        where: { active: true },
        orderBy: { symbol: 'asc' },
        select: { id: true, symbol: true },
      })

      const results = []
      for (const t of tickers) {
        const r = await backfillTicker(t.id, { yearsBack: 1 })
        results.push(r)
        if (r.error) {
          log.warn({ symbol: t.symbol, err: r.error }, 'ticker backfill failed')
        } else {
          log.info(
            { symbol: t.symbol, rowsInserted: r.rowsInserted },
            'ticker backfill ok',
          )
        }
      }

      const errors = results.filter((r) => r.error).length
      const inserted = results.reduce((n, r) => n + r.rowsInserted, 0)
      const status = errors > 0 ? 'error' : 'ok'
      const errorMsg =
        errors > 0 ? `${errors}/${results.length} tickers failed` : null

      return {
        result: {
          ok: errors === 0,
          tickers: results.length,
          errors,
          rowsInserted: inserted,
        },
        status,
        errorMsg,
        metrics: { tickers: results.length, errors, rowsInserted: inserted },
      }
    })

    return Response.json(payload)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return new Response(message, { status: 500 })
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
