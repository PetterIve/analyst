import { Bot } from 'grammy'
import { logger } from '#/lib/logger.server'
import { registerCommands } from './commands.js'
import { registerCallbacks } from './callbacks.js'

let cached: Bot | null = null

/**
 * Lazily instantiate the grammy bot. `TELEGRAM_BOT_TOKEN` must be set before
 * this is called — on boot, on every webhook hit, and from the admin
 * "Send test alert" flow. Returns the same instance across calls so handlers
 * are registered exactly once.
 */
export function getBot(): Bot {
  if (cached) return cached

  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN is not set')
  }

  const bot = new Bot(token)
  registerCommands(bot)
  registerCallbacks(bot)

  bot.catch((err) => {
    logger.error(
      { err: err.error instanceof Error ? err.error.message : String(err.error) },
      'telegram bot handler threw',
    )
  })

  cached = bot
  return bot
}

export function telegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN)
}
