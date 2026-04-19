import type { InlineKeyboardMarkup } from 'grammy/types'

export interface AlertMessageInput {
  alertId: number
  symbol: string
  direction: 'long' | 'short'
  entryPrice: number
  thesis: string
  topCatalyst: string
  expectedReturn5d: number
  hitRate: number
  nComparables: number
  invalidation: string
}

export interface FormattedAlert {
  text: string
  parse_mode: 'HTML'
  reply_markup: InlineKeyboardMarkup
}

/**
 * Escape HTML special characters per the subset Telegram's HTML parse_mode
 * recognises (https://core.telegram.org/bots/api#html-style). Only `&`, `<`,
 * `>` need escaping — tags we intentionally emit (`<b>`, `<i>`) get built
 * around the escaped content.
 */
export function escapeHtml(input: string): string {
  return input.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function formatPrice(v: number): string {
  return v.toFixed(2)
}

function formatPercent(v: number): string {
  // v is a decimal (0.042 = +4.2%). Preserve sign and one decimal.
  const sign = v >= 0 ? '+' : ''
  return `${sign}${(v * 100).toFixed(1)}%`
}

function formatHitRate(v: number): string {
  return `${Math.round(v * 100)}%`
}

export function formatAlert(
  input: AlertMessageInput,
  auditUrl: string,
): FormattedAlert {
  const directionLabel = input.direction === 'long' ? 'LONG' : 'SHORT'

  const lines = [
    `🛢️ <b>${directionLabel} $${escapeHtml(input.symbol)} @ ${formatPrice(input.entryPrice)}</b>`,
    '',
    `<b>Thesis:</b> ${escapeHtml(input.thesis)}`,
    '',
    `<b>Catalyst:</b> ${escapeHtml(input.topCatalyst)}`,
    '',
    `<b>Expected 5d:</b> ${formatPercent(input.expectedReturn5d)} (hit rate ${formatHitRate(input.hitRate)}, N=${input.nComparables} comparables)`,
    `<b>Invalidation:</b> ${escapeHtml(input.invalidation)}`,
  ]

  return {
    text: lines.join('\n'),
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '👍 Helpful', callback_data: `rate:${input.alertId}:up` },
          { text: '👎 Not useful', callback_data: `rate:${input.alertId}:down` },
        ],
        [{ text: '🔗 Full audit', url: auditUrl }],
      ],
    },
  }
}
