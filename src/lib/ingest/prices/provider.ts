export interface DailyBar {
  date: Date
  open: number
  high: number
  low: number
  close: number
  adjClose: number
  volume: bigint
}

export interface PriceProvider {
  readonly name: string
  fetchDaily(symbol: string, from: Date, to: Date): Promise<DailyBar[]>
}
