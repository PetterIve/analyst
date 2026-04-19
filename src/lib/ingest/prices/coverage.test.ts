import { describe, expect, it } from 'vitest'
import {
  STALE_AFTER_DAYS,
  THIN_ROW_THRESHOLD,
  deriveCoverageStatus,
} from './coverage'

const NOW = new Date('2026-04-19T12:00:00Z')

function daysAgo(n: number): Date {
  const d = new Date(NOW)
  d.setUTCDate(d.getUTCDate() - n)
  return d
}

describe('deriveCoverageStatus', () => {
  it('returns missing when there are no rows', () => {
    const result = deriveCoverageStatus({
      rowCount: 0,
      lastDate: null,
      now: NOW,
    })
    expect(result).toEqual({ status: 'missing', ageDays: null })
  })

  it('returns thin below the row threshold even if recent', () => {
    const result = deriveCoverageStatus({
      rowCount: THIN_ROW_THRESHOLD - 1,
      lastDate: daysAgo(0),
      now: NOW,
    })
    expect(result.status).toBe('thin')
  })

  it('returns ok at exactly the row threshold when fresh', () => {
    const result = deriveCoverageStatus({
      rowCount: THIN_ROW_THRESHOLD,
      lastDate: daysAgo(1),
      now: NOW,
    })
    expect(result).toEqual({ status: 'ok', ageDays: 1 })
  })

  it('returns stale when last row is older than the staleness window', () => {
    const result = deriveCoverageStatus({
      rowCount: THIN_ROW_THRESHOLD + 500,
      lastDate: daysAgo(STALE_AFTER_DAYS + 1),
      now: NOW,
    })
    expect(result.status).toBe('stale')
    expect(result.ageDays).toBe(STALE_AFTER_DAYS + 1)
  })

  it('stays ok at exactly the staleness boundary', () => {
    const result = deriveCoverageStatus({
      rowCount: THIN_ROW_THRESHOLD + 500,
      lastDate: daysAgo(STALE_AFTER_DAYS),
      now: NOW,
    })
    expect(result).toEqual({ status: 'ok', ageDays: STALE_AFTER_DAYS })
  })

  it('prefers thin over stale when both would apply', () => {
    const result = deriveCoverageStatus({
      rowCount: 10,
      lastDate: daysAgo(30),
      now: NOW,
    })
    expect(result.status).toBe('thin')
  })
})
