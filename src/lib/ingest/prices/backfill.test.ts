import { describe, expect, it } from 'vitest'
import { computeBackfillRange } from './backfill'

const NOW = new Date('2026-04-19T12:00:00Z')

describe('computeBackfillRange', () => {
  it('goes back yearsBack years when no prior rows exist', () => {
    const { from, to, skipped } = computeBackfillRange({
      latestDate: null,
      now: NOW,
      yearsBack: 5,
    })
    expect(from.toISOString()).toBe('2021-04-19T00:00:00.000Z')
    expect(to.toISOString()).toBe('2026-04-20T00:00:00.000Z')
    expect(skipped).toBe(false)
  })

  it('resumes from the day after the last stored bar', () => {
    const latest = new Date('2026-04-15T00:00:00Z')
    const { from, to, skipped } = computeBackfillRange({
      latestDate: latest,
      now: NOW,
      yearsBack: 5,
    })
    expect(from.toISOString()).toBe('2026-04-16T00:00:00.000Z')
    expect(to.toISOString()).toBe('2026-04-20T00:00:00.000Z')
    expect(skipped).toBe(false)
  })

  it('skips when the last stored bar is already at today', () => {
    // Today (UTC) is 2026-04-19; `to` = today + 1. A latest=today yields
    // from = today + 1 = to, which must be reported as skipped so we don't
    // re-pull. This is the "cron re-downloads 1200 rows every night"
    // regression we guard against.
    const latest = new Date('2026-04-19T00:00:00Z')
    const { from, to, skipped } = computeBackfillRange({
      latestDate: latest,
      now: NOW,
      yearsBack: 5,
    })
    expect(from.getTime()).toBe(to.getTime())
    expect(skipped).toBe(true)
  })

  it('skips when the last stored bar is in the future', () => {
    const latest = new Date('2026-05-01T00:00:00Z')
    const { skipped } = computeBackfillRange({
      latestDate: latest,
      now: NOW,
      yearsBack: 5,
    })
    expect(skipped).toBe(true)
  })

  it('honors yearsBack when resuming from empty', () => {
    const { from } = computeBackfillRange({
      latestDate: null,
      now: NOW,
      yearsBack: 1,
    })
    expect(from.toISOString()).toBe('2025-04-19T00:00:00.000Z')
  })
})
