import type { Bot, Context } from 'grammy'
import { logger } from '#/lib/logger.server'

export type CallbackPrefix = 'rate'

export interface ParsedCallback {
  prefix: CallbackPrefix
  alertId: number
  value: 'up' | 'down'
}

/**
 * Parse a `rate:{alertId}:{up|down}` callback_data payload. Other prefixes
 * return null so the dispatcher can log + ignore them without crashing.
 */
export function parseCallback(data: string): ParsedCallback | null {
  const parts = data.split(':')
  if (parts.length !== 3) return null
  const [prefix, idStr, value] = parts
  if (prefix !== 'rate') return null
  const alertId = Number.parseInt(idStr, 10)
  if (!Number.isInteger(alertId) || alertId < 0) return null
  if (value !== 'up' && value !== 'down') return null
  return { prefix, alertId, value }
}

export type RateHandler = (
  ctx: Context,
  parsed: ParsedCallback,
) => Promise<void> | void

// T14 replaces this stub with real persistence into the `ratings` table.
const defaultRateHandler: RateHandler = async (ctx, parsed) => {
  const chatId = ctx.chat ? String(ctx.chat.id) : 'unknown'
  logger.info(
    { chatId, alertId: parsed.alertId, value: parsed.value },
    'telegram rating received (persistence lands in T14)',
  )
  await ctx.answerCallbackQuery(
    parsed.value === 'up' ? 'Thanks — noted 👍' : 'Noted — will tune accordingly',
  )
}

let rateHandler: RateHandler = defaultRateHandler

/**
 * T14 calls this to swap in the real persistence handler without touching
 * the dispatcher wiring.
 */
export function setRateHandler(handler: RateHandler): void {
  rateHandler = handler
}

export function registerCallbacks(bot: Bot): void {
  bot.on('callback_query:data', async (ctx) => {
    const data = ctx.callbackQuery.data
    const parsed = parseCallback(data)
    if (!parsed) {
      logger.warn({ data }, 'unknown telegram callback')
      await ctx.answerCallbackQuery()
      return
    }
    await rateHandler(ctx, parsed)
  })
}
