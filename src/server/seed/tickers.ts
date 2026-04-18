import type { Segment } from '../../generated/prisma/client.js'

export interface TickerSeed {
  symbol: string
  exchange: string
  segment: Segment
  name: string
  notes: string
}

export const tickerSeeds: ReadonlyArray<TickerSeed> = [
  // Crude tankers
  {
    symbol: 'FRO',
    exchange: 'NYSE',
    segment: 'crude',
    name: 'Frontline plc',
    notes: 'Large VLCC/Suezmax fleet; high beta to Russia sanctions & Red Sea disruption.',
  },
  {
    symbol: 'DHT',
    exchange: 'NYSE',
    segment: 'crude',
    name: 'DHT Holdings',
    notes: 'Pure-play VLCC; cleanest exposure to crude spot rates.',
  },
  {
    symbol: 'INSW',
    exchange: 'NYSE',
    segment: 'mixed',
    name: 'International Seaways',
    notes: 'Mixed crude + product; diversified across segments.',
  },
  {
    symbol: 'NAT',
    exchange: 'NYSE',
    segment: 'crude',
    name: 'Nordic American Tankers',
    notes: 'Pure-play Suezmax; high dividend payout model.',
  },
  {
    symbol: 'TNK',
    exchange: 'NYSE',
    segment: 'mixed',
    name: 'Teekay Tankers',
    notes: 'Mid-size crude (Suezmax/Aframax) + some LR2 product.',
  },
  {
    symbol: 'OET',
    exchange: 'OSE',
    segment: 'crude',
    name: 'Okeanis Eco Tankers',
    notes: 'Modern VLCC/Suezmax fleet; Oslo listed.',
  },
  {
    symbol: 'CMBT',
    exchange: 'NYSE',
    segment: 'crude',
    name: 'CMB.TECH (ex-Euronav)',
    notes: 'Formed from Euronav merger; crude + decarbonization bets.',
  },
  // Product tankers
  {
    symbol: 'STNG',
    exchange: 'NYSE',
    segment: 'product',
    name: 'Scorpio Tankers',
    notes: 'Largest pure product tanker operator (LR2/MR); strong balance sheet.',
  },
  {
    symbol: 'TRMD',
    exchange: 'NASDAQ',
    segment: 'product',
    name: 'TORM plc',
    notes: 'Pure product tankers; MR-heavy; Russia-sanction beneficiary via tonne-miles.',
  },
  {
    symbol: 'ASC',
    exchange: 'NYSE',
    segment: 'product',
    name: 'Ardmore Shipping',
    notes: 'MR-focused product; smaller but high leverage to clean rates.',
  },
  {
    symbol: 'HAFNI',
    exchange: 'OSE',
    segment: 'product',
    name: 'Hafnia',
    notes: 'Largest product tanker pool operator; Oslo listed.',
  },
  {
    symbol: 'TK',
    exchange: 'NYSE',
    segment: 'mixed',
    name: 'Teekay Corporation',
    notes: 'Parent of TNK; gas + tanker exposure; strategic holdings.',
  },
  // Benchmark (tracked alongside but not an alert target)
  {
    symbol: 'XLE',
    exchange: 'NYSE',
    segment: 'mixed',
    name: 'Energy Select Sector SPDR',
    notes: 'Sector-beta benchmark for outcome tracking (T13). Not an alert target.',
  },
] as const
