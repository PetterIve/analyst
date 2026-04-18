import { createFileRoute } from '@tanstack/react-router'
import { logger } from '#/lib/logger.server'

type Level = 'debug' | 'info' | 'warn' | 'error'

type Entry = {
  level: Level
  msg: string
  args: unknown[]
  ts: number
  url: string
}

const isDev = process.env.NODE_ENV !== 'production'

async function handler({ request }: { request: Request }) {
  if (!isDev) {
    return new Response('Not found', { status: 404 })
  }
  let payload: { entries?: Entry[] }
  try {
    payload = await request.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }
  const entries = payload.entries ?? []
  for (const entry of entries) {
    const child = logger.child({
      source: 'client',
      url: entry.url,
      clientTs: entry.ts,
    })
    const fn = child[entry.level] ?? child.info
    fn.call(child, { args: entry.args }, entry.msg)
  }
  return new Response(null, { status: 204 })
}

export const Route = createFileRoute('/api/logs')({
  server: {
    handlers: {
      POST: handler,
    },
  },
})
