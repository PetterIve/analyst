import { createFileRoute } from '@tanstack/react-router'
import { webhookCallback } from 'grammy'
import { logger } from '#/lib/logger.server'
import { getBot, telegramConfigured } from '#/server/telegram/bot'
import { telegramAuthEnv, verifyTelegramSecret } from '#/server/telegram/auth'

async function handler({ request }: { request: Request }) {
  if (!telegramConfigured()) {
    return new Response('Telegram not configured', { status: 503 })
  }
  if (!verifyTelegramSecret(request.headers, telegramAuthEnv())) {
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
