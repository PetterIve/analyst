export const STALE_AFTER_DAYS = 5
export const THIN_ROW_THRESHOLD = 1200

export type CoverageStatus = 'ok' | 'stale' | 'thin' | 'missing'

export interface DeriveCoverageStatusInput {
  rowCount: number
  lastDate: Date | null
  now: Date
}

export interface DeriveCoverageStatusResult {
  status: CoverageStatus
  ageDays: number | null
}

export function deriveCoverageStatus({
  rowCount,
  lastDate,
  now,
}: DeriveCoverageStatusInput): DeriveCoverageStatusResult {
  const ageDays = lastDate ? diffDaysUtc(lastDate, now) : null
  if (rowCount === 0) return { status: 'missing', ageDays }
  if (rowCount < THIN_ROW_THRESHOLD) return { status: 'thin', ageDays }
  if (ageDays !== null && ageDays > STALE_AFTER_DAYS) {
    return { status: 'stale', ageDays }
  }
  return { status: 'ok', ageDays }
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

function diffDaysUtc(a: Date, b: Date): number {
  const ms = startOfUtcDay(b).getTime() - startOfUtcDay(a).getTime()
  return Math.round(ms / (1000 * 60 * 60 * 24))
}
