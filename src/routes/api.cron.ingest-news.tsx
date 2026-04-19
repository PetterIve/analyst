import { createFileRoute } from '@tanstack/react-router'
import { prisma } from '#/server/db'
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

  const cronRun = await prisma.cronRun.create({
    data: { jobName: JOB_NAME, startedAt: new Date(), status: 'ok' },
  })

  try {
    const result = await runNewsIngest()
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
    return Response.json({
      ok: true,
      totalInserted: result.totalInserted,
      perSource: result.perSource,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await prisma.cronRun.update({
      where: { id: cronRun.id },
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
