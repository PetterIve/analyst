import YahooFinance from 'yahoo-finance2'
import type { DailyBar, PriceProvider } from './provider'

const yahooFinance = new YahooFinance()

interface YahooChartQuote {
  date: Date
  high: number | null
  low: number | null
  open: number | null
  close: number | null
  volume: number | null
  adjclose?: number | null
}

const yahooSymbolOverrides: Readonly<Record<string, string>> = {
  OET: 'OET.OL',
  HAFNI: 'HAFNI.OL',
  TRMD: 'TRMD-A.CO',
}

export function toYahooSymbol(dbSymbol: string): string {
  return yahooSymbolOverrides[dbSymbol] ?? dbSymbol
}

export const yahooPriceProvider: PriceProvider = {
  name: 'yahoo-finance2',

  async fetchDaily(dbSymbol: string, from: Date, to: Date): Promise<DailyBar[]> {
    const yahooSymbol = toYahooSymbol(dbSymbol)
    const result = (await yahooFinance.chart(yahooSymbol, {
      period1: from,
      period2: to,
      interval: '1d',
      return: 'array',
    })) as { quotes: YahooChartQuote[] }

    const bars: DailyBar[] = []
    for (const quote of result.quotes) {
      if (
        quote.open == null ||
        quote.high == null ||
        quote.low == null ||
        quote.close == null ||
        quote.volume == null
      ) {
        continue
      }
      const adj = quote.adjclose ?? quote.close
      bars.push({
        date: startOfUtcDay(quote.date),
        open: quote.open,
        high: quote.high,
        low: quote.low,
        close: quote.close,
        adjClose: adj,
        volume: BigInt(Math.round(quote.volume)),
      })
    }
    return bars
  },
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}
