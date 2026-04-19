/**
 * Authorization helpers for the Telegram HTTP routes. Extracted from the
 * route handlers so the fail-closed / fail-open policy is unit-testable
 * — these checks are security-critical and easy to break silently.
 */

const SECRET_HEADER = 'x-telegram-bot-api-secret-token'

export interface TelegramAuthEnv {
  expectedSecret: string | undefined
  nodeEnv: string | undefined
}

export interface CronAuthEnv {
  cronSecret: string | undefined
  nodeEnv: string | undefined
}

/**
 * Telegram signs inbound webhook requests with the secret we registered via
 * setWebhook({ secret_token }). Without a configured expected secret, we
 * fail closed in production and fail open in dev so `npm run dev:bot`
 * + manual curl testing are frictionless.
 */
export function verifyTelegramSecret(
  headers: Headers,
  env: TelegramAuthEnv,
): boolean {
  if (!env.expectedSecret) {
    return env.nodeEnv !== 'production'
  }
  return headers.get(SECRET_HEADER) === env.expectedSecret
}

/**
 * The /api/telegram/register route is an admin operation; gate it with the
 * same bearer CRON_SECRET used by /api/cron/*. Dev convenience: if no
 * secret is configured AND we're not in production, let it through.
 */
export function verifyCronBearer(
  headers: Headers,
  env: CronAuthEnv,
): boolean {
  if (!env.cronSecret) {
    return env.nodeEnv !== 'production'
  }
  return headers.get('authorization') === `Bearer ${env.cronSecret}`
}

export function telegramAuthEnv(): TelegramAuthEnv {
  return {
    expectedSecret: process.env.TELEGRAM_WEBHOOK_SECRET,
    nodeEnv: process.env.NODE_ENV,
  }
}

export function cronAuthEnv(): CronAuthEnv {
  return {
    cronSecret: process.env.CRON_SECRET,
    nodeEnv: process.env.NODE_ENV,
  }
}
