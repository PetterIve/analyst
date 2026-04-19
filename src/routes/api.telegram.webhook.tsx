import { createFileRoute } from '@tanstack/react-router'
import { webhookCallback } from 'grammy'
import { logger } from '#/lib/logger.server'
import { getBot, telegramConfigured } from '#/server/telegram/bot'

const SECRET_HEADER = 'x-telegram-bot-api-secret-token'

function verifySecret(request: Request): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!expected) {
    // Must be explicit — an unset secret means the endpoint is wide open,
    // which in prod is the kind of thing we don't want to fall into. Fail
    // closed in prod, fail open in dev for easier local testing.
    return process.env.NODE_ENV !== 'production'
  }
  return request.headers.get(SECRET_HEADER) === expected
}

async function handler({ request }: { request: Request }) {
  if (!telegramConfigured()) {
    return new Response('Telegram not configured', { status: 503 })
  }
  if (!verifySecret(request)) {
    logger.warn('telegram webhook rejected: bad secret')
    return new Response('Unauthorized', { status: 401 })
  }

  const callback = webhookCallback(getBot(), 'std/http')
  return callback(request)
}

export const Route = createFileRoute('/api/telegram/webhook')({
  server: {
    handlers: {
      POST: handler,
    },
  },
})
