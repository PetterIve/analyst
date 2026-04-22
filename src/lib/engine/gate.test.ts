import { describe, expect, it } from 'vitest'
import { gateAlert } from './gate'

// Helper: build a UTC instant that corresponds to a specific wall-clock time
// in America/New_York. Expressed in UTC offsets: EST = UTC-5, EDT = UTC-4.
function etToUtc(y: number, m: number, d: number, h: number, min: number, dst: boolean): Date {
  const offsetHours = dst ? 4 : 5
  return new Date(Date.UTC(y, m - 1, d, h + offsetHours, min))
}

describe('gateAlert', () => {
  it('delivers immediately for non-US tickers regardless of time', () => {
    // Sunday 03:00 ET
    const fired = etToUtc(2025, 6, 15, 3, 0, true)
    expect(gateAlert(fired, false)).toEqual({ state: 'pending', deliverAt: null })
  })

  it('delivers during RTH on a weekday', () => {
    // Wednesday 11:00 ET (EDT)
    const fired = etToUtc(2025, 6, 11, 11, 0, true)
    const r = gateAlert(fired, true)
    expect(r.state).toBe('pending')
    expect(r.deliverAt).toBeNull()
  })

  it('delivers immediately in weekday pre-market (08:00–09:29 ET)', () => {
    // Wednesday 08:45 ET
    const fired = etToUtc(2025, 6, 11, 8, 45, true)
    expect(gateAlert(fired, true)).toEqual({ state: 'pending', deliverAt: null })
  })

  it('holds an alert fired before weekday 08:00 until today 08:00 ET', () => {
    // Wednesday 06:00 ET
    const fired = etToUtc(2025, 6, 11, 6, 0, true)
    const r = gateAlert(fired, true)
    expect(r.state).toBe('held')
    expect(r.deliverAt!.toISOString()).toBe(etToUtc(2025, 6, 11, 8, 0, true).toISOString())
  })

  it('holds an alert fired after close until next weekday 08:00 ET', () => {
    // Thursday 17:30 ET → Friday 08:00 ET
    const fired = etToUtc(2025, 6, 12, 17, 30, true)
    const r = gateAlert(fired, true)
    expect(r.state).toBe('held')
    expect(r.deliverAt!.toISOString()).toBe(etToUtc(2025, 6, 13, 8, 0, true).toISOString())
  })

  it('pushes a Saturday alert to Monday 08:00 ET', () => {
    // Saturday 10:00 ET → Monday 08:00 ET
    const fired = etToUtc(2025, 6, 14, 10, 0, true)
    const r = gateAlert(fired, true)
    expect(r.state).toBe('held')
    expect(r.deliverAt!.toISOString()).toBe(etToUtc(2025, 6, 16, 8, 0, true).toISOString())
  })

  it('pushes a Friday after-close alert to Monday 08:00 ET', () => {
    // Friday 20:00 ET (EDT) → Monday 08:00 ET
    const fired = etToUtc(2025, 6, 13, 20, 0, true)
    const r = gateAlert(fired, true)
    expect(r.state).toBe('held')
    expect(r.deliverAt!.toISOString()).toBe(etToUtc(2025, 6, 16, 8, 0, true).toISOString())
  })

  it('handles the standard-time window correctly', () => {
    // January Friday 20:00 ET (EST) → Monday 08:00 ET (EST)
    const fired = etToUtc(2025, 1, 10, 20, 0, false)
    const r = gateAlert(fired, true)
    expect(r.state).toBe('held')
    expect(r.deliverAt!.toISOString()).toBe(etToUtc(2025, 1, 13, 8, 0, false).toISOString())
  })
})
