import type { PrismaClient } from '#/generated/prisma/client'

type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0]

/**
 * Entry-price source for new alerts.
 *
 * MVP uses the most recent `prices_daily.close` — good enough for paper
 * tracking (T13 computes returns off daily closes anyway, so there's no
 * divergence between entry price and outcome anchor). A real intraday quote
 * provider can replace this later without changing callers.
 */
export async function latestEntryPrice(tx: Tx, tickerId: number): Promise<number | null> {
  const row = await tx.priceDaily.findFirst({
    where: { tickerId },
    orderBy: { date: 'desc' },
    select: { close: true },
  })
  return row?.close ?? null
}
