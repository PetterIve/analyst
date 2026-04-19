import { describe, expect, it } from 'vitest'
import {
  escapeHtml,
  formatAlert,
  type AlertMessageInput,
} from './format-alert'

const base: AlertMessageInput = {
  alertId: 42,
  symbol: 'FRO',
  direction: 'long',
  entryPrice: 21.34,
  thesis: 'VLCC rates surged on Red Sea disruption.',
  topCatalyst: 'Tanker hit off Yemen coast; rerouting extends tonne-miles.',
  expectedReturn5d: 0.042,
  hitRate: 0.67,
  nComparables: 18,
  invalidation: 'Ceasefire announced or rates revert >5% in 2d.',
}

describe('escapeHtml', () => {
  it('escapes &, <, > but leaves other punctuation alone', () => {
    expect(escapeHtml('AT&T <b>bold</b>')).toBe('AT&amp;T &lt;b&gt;bold&lt;/b&gt;')
  })

  it('is a no-op for safe text', () => {
    expect(escapeHtml("Nothing to escape here.")).toBe("Nothing to escape here.")
  })
})

describe('formatAlert', () => {
  const audit = 'https://analyst.example/alerts/42'

  it('includes direction, symbol, and price in the header', () => {
    const out = formatAlert(base, audit)
    expect(out.text).toContain('LONG $FRO @ 21.34')
  })

  it('switches direction to SHORT correctly', () => {
    const out = formatAlert({ ...base, direction: 'short' }, audit)
    expect(out.text).toContain('SHORT $FRO')
  })

  it('formats expected return with sign and percent', () => {
    const pos = formatAlert({ ...base, expectedReturn5d: 0.042 }, audit)
    expect(pos.text).toContain('+4.2%')
    const neg = formatAlert({ ...base, expectedReturn5d: -0.021 }, audit)
    expect(neg.text).toContain('-2.1%')
  })

  it('rounds hit rate to a whole percent', () => {
    expect(formatAlert({ ...base, hitRate: 0.673 }, audit).text).toContain('67%')
  })

  it('HTML-escapes dynamic thesis / catalyst / invalidation', () => {
    const out = formatAlert(
      {
        ...base,
        thesis: '<script>alert(1)</script>',
        topCatalyst: 'Rates & tonne-miles rise',
        invalidation: '>5% revert',
      },
      audit,
    )
    expect(out.text).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(out.text).toContain('Rates &amp; tonne-miles rise')
    expect(out.text).toContain('&gt;5% revert')
    // The intentional <b> we wrap around labels survives.
    expect(out.text).toContain('<b>Thesis:</b>')
  })

  it('builds an inline keyboard with rate:{id}:up|down + audit URL', () => {
    const out = formatAlert(base, audit)
    const rows = out.reply_markup.inline_keyboard
    expect(rows).toHaveLength(2)

    const rateRow = rows[0]
    expect(rateRow).toHaveLength(2)
    expect(rateRow[0]).toMatchObject({ callback_data: 'rate:42:up' })
    expect(rateRow[1]).toMatchObject({ callback_data: 'rate:42:down' })

    const auditRow = rows[1]
    expect(auditRow).toHaveLength(1)
    expect(auditRow[0]).toMatchObject({ url: audit })
  })

  it('uses HTML parse mode', () => {
    expect(formatAlert(base, audit).parse_mode).toBe('HTML')
  })
})
