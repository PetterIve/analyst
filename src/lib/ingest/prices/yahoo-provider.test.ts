import { describe, expect, it } from 'vitest'
import { toYahooSymbol } from './yahoo-provider'

describe('toYahooSymbol', () => {
  it('maps European listings to their Yahoo suffixes', () => {
    expect(toYahooSymbol('OET')).toBe('OET.OL')
    expect(toYahooSymbol('HAFNI')).toBe('HAFNI.OL')
    expect(toYahooSymbol('TRMD')).toBe('TRMD-A.CO')
  })

  it('passes US-listed tickers through unchanged', () => {
    for (const sym of ['FRO', 'DHT', 'STNG', 'ASC', 'INSW', 'XLE']) {
      expect(toYahooSymbol(sym)).toBe(sym)
    }
  })
})
