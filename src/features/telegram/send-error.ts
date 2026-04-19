import { logger } from '#/lib/logger.server'
import { getBot, telegramConfigured } from './bot.js'

export interface CronErrorInput {
  jobName: string
  runId: number
  message: string
}

/**
 * Post a fatal cron error to the dedicated error-channel chat. No-op when
 * `TELEGRAM_ERROR_CHAT_ID` (or the bot token) is unset, so local dev and
 * preview deploys stay quiet.
 */
export async function sendCronError(input: CronErrorInput): Promise<boolean> {
  const chatId = process.env.TELEGRAM_ERROR_CHAT_ID
  if (!chatId || !telegramConfigured()) return false

  const text = formatCronError(input)
  try {
    const bot = getBot()
    await bot.api.sendMessage(chatId, text, { parse_mode: 'HTML' })
    return true
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    logger.warn(
      { chatId, jobName: input.jobName, runId: input.runId, err: errMsg },
      'send-error to telegram failed',
    )
    return false
  }
}

function formatCronError({ jobName, runId, message }: CronErrorInput): string {
  const ts = new Date().toISOString()
  // Keep under Telegram's 4096-char message cap; truncate long stack traces.
  const trimmed = message.length > 3500 ? `${message.slice(0, 3500)}…` : message
  return [
    `<b>Cron failure</b>`,
    `<code>${escapeHtml(jobName)}</code> · run #${runId}`,
    `<i>${ts}</i>`,
    '',
    `<pre>${escapeHtml(trimmed)}</pre>`,
  ].join('\n')
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
