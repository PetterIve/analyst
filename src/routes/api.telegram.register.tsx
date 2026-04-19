import { createFileRoute } from '@tanstack/react-router'
import { logger } from '#/lib/logger.server'
import { getBot, telegramConfigured } from '#/server/telegram/bot'

function authorized(request: Request): boolean {
  // Registration is a one-shot admin op (set + query webhook URL). Gate the
  // same way cron routes do — bearer `CRON_SECRET`. In dev with no secret
  // set, allow the call so local smoke testing is ergonomic.
  const secret = process.env.CRON_SECRET
  if (!secret) return process.env.NODE_ENV !== 'production'
  return request.headers.get('authorization') === `Bearer ${secret}`
}

async function handler({ request }: { request: Request }) {
  if (!telegramConfigured()) {
    return new Response('TELEGRAM_BOT_TOKEN is not set', { status: 503 })
  }
  if (!authorized(request)) {
    return new Response('Unauthorized', { status: 401 })
  }

  // POST = set webhook, GET = show current webhook info.
  const bot = getBot()

  if (request.method === 'GET') {
    const info = await bot.api.getWebhookInfo()
    return Response.json(info)
  }

  // POST: derive URL from env or request body.
  const body = await readJsonSafe(request)
  const publicUrl = body?.url ?? process.env.PUBLIC_APP_URL
  if (!publicUrl) {
    return new Response(
      'Provide `url` in the POST body or set PUBLIC_APP_URL',
      { status: 400 },
    )
  }
  const webhookUrl = `${publicUrl.replace(/\/$/, '')}/api/telegram/webhook`
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET

  await bot.api.setWebhook(webhookUrl, {
    secret_token: secret ?? undefined,
    allowed_updates: ['message', 'callback_query'],
  })
  logger.info({ webhookUrl, hasSecret: Boolean(secret) }, 'telegram webhook registered')

  return Response.json({ ok: true, webhookUrl })
}

async function readJsonSafe(request: Request): Promise<{ url?: string } | null> {
  try {
    return (await request.json()) as { url?: string }
  } catch {
    return null
  }
}

export const Route = createFileRoute('/api/telegram/register')({
  server: {
    handlers: {
      GET: handler,
      POST: handler,
    },
  },
})
