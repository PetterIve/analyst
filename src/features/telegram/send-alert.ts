import { prisma } from '#/server/db'
import { logger } from '#/lib/logger.server'
import { getBot } from './bot.js'
import { formatAlert, type AlertMessageInput } from './format-alert.js'

export interface SendAlertResult {
  sent: number
  failed: number
  deliveries: Array<{
    chatId: string
    messageId: number | null
    error: string | null
  }>
}

/**
 * Fan an alert message out to every active subscriber. T11 will call this
 * from the alert-composer pipeline; for now it's also how we smoke-test the
 * bot end-to-end.
 */
export async function sendAlert(
  input: AlertMessageInput,
  auditUrl: string,
): Promise<SendAlertResult> {
  const bot = getBot()
  const payload = formatAlert(input, auditUrl)
  const subscribers = await prisma.subscriber.findMany({
    where: { active: true },
    select: { chatId: true },
  })

  const deliveries: SendAlertResult['deliveries'] = []
  for (const sub of subscribers) {
    try {
      const message = await bot.api.sendMessage(sub.chatId, payload.text, {
        parse_mode: payload.parse_mode,
        reply_markup: payload.reply_markup,
      })
      deliveries.push({
        chatId: sub.chatId,
        messageId: message.message_id,
        error: null,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      deliveries.push({ chatId: sub.chatId, messageId: null, error: message })
      logger.warn({ chatId: sub.chatId, alertId: input.alertId, err: message }, 'send-alert failed for chat')
    }
  }

  const sent = deliveries.filter((d) => d.error === null).length
  logger.info(
    {
      alertId: input.alertId,
      symbol: input.symbol,
      sent,
      failed: deliveries.length - sent,
    },
    'alert fanout finished',
  )

  return { sent, failed: deliveries.length - sent, deliveries }
}
