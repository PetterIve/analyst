/**
 * US regular-trading-hours gate.
 *
 * If `firedAt` is outside 09:30–16:00 America/New_York on a weekday, the alert
 * is held until the next 08:00 ET pre-market window. This keeps users from
 * waking up to stale overnight pings and lets us send a morning digest
 * instead. Weekends always push to Monday pre-market.
 *
 * Pure: takes `firedAt` (or "now") as input, returns `{ state, deliverAt }`.
 */

export type GateResult =
  | { state: 'pending'; deliverAt: null }
  | { state: 'held'; deliverAt: Date }

const ET_ZONE = 'America/New_York'
const RTH_OPEN_MINUTES = 9 * 60 + 30
const RTH_CLOSE_MINUTES = 16 * 60
const PREMARKET_HOUR_ET = 8

interface ETParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  weekday: number // 0=Sun..6=Sat
}

function etParts(d: Date): ETParts {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: ET_ZONE,
    hourCycle: 'h23',
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  const parts = Object.fromEntries(
    fmt.formatToParts(d).map((p) => [p.type, p.value] as const),
  )
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  }
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    weekday: weekdayMap[parts.weekday as string] ?? 0,
  }
}

/**
 * Return a UTC Date that corresponds to `targetHour:00` ET on the given ET
 * calendar date. Handles DST by iterating: we construct a candidate UTC
 * guess, read it back in ET, and correct.
 */
function etWallClockToUtc(year: number, month: number, day: number, targetHourET: number): Date {
  // Guess assuming EST (UTC-5); refine with the offset the formatter reports.
  let guess = new Date(Date.UTC(year, month - 1, day, targetHourET + 5, 0))
  for (let i = 0; i < 3; i++) {
    const got = etParts(guess)
    const diffHours =
      got.hour - targetHourET + (got.day !== day || got.month !== month || got.year !== year ? 0 : 0)
    // Normalize across day boundaries by comparing UTC-equivalent moments
    const gotMs = Date.UTC(got.year, got.month - 1, got.day, got.hour, got.minute)
    const wantMs = Date.UTC(year, month - 1, day, targetHourET, 0)
    const adjust = wantMs - gotMs
    if (adjust === 0) break
    guess = new Date(guess.getTime() + adjust)
    if (Math.abs(diffHours) < 1e-6) break
  }
  return guess
}

function isWeekend(weekday: number): boolean {
  return weekday === 0 || weekday === 6
}

function advanceEtDateToNextWeekday(parts: ETParts): { year: number; month: number; day: number } {
  let year = parts.year
  let month = parts.month
  let day = parts.day
  let weekday = parts.weekday
  for (;;) {
    day += 1
    // Increment via Date to roll month/year cleanly
    const d = new Date(Date.UTC(year, month - 1, day))
    year = d.getUTCFullYear()
    month = d.getUTCMonth() + 1
    day = d.getUTCDate()
    weekday = (weekday + 1) % 7
    if (!isWeekend(weekday)) return { year, month, day }
  }
}

/**
 * Pure gate: given when the alert fired, decide immediate-delivery vs hold.
 *
 * @param firedAt wall-clock moment the engine decided to fire.
 * @param usListed only US-listed tickers are gated; non-US get state=pending.
 */
export function gateAlert(firedAt: Date, usListed: boolean): GateResult {
  if (!usListed) return { state: 'pending', deliverAt: null }

  const et = etParts(firedAt)
  const withinRth =
    !isWeekend(et.weekday) &&
    et.hour * 60 + et.minute >= RTH_OPEN_MINUTES &&
    et.hour * 60 + et.minute < RTH_CLOSE_MINUTES

  if (withinRth) return { state: 'pending', deliverAt: null }

  // Outside RTH — deliver at the next pre-market window (next weekday 08:00 ET,
  // or today 08:00 ET if we're still pre-open on a weekday).
  const beforeOpenToday =
    !isWeekend(et.weekday) && et.hour * 60 + et.minute < RTH_OPEN_MINUTES
  if (beforeOpenToday && et.hour >= PREMARKET_HOUR_ET) {
    // It's weekday, 08:00–09:29 ET — deliver immediately (already pre-market).
    return { state: 'pending', deliverAt: null }
  }
  if (beforeOpenToday) {
    // Weekday, before 08:00 ET — wait for 08:00 today.
    return {
      state: 'held',
      deliverAt: etWallClockToUtc(et.year, et.month, et.day, PREMARKET_HOUR_ET),
    }
  }

  // After close or weekend — advance to next weekday's 08:00 ET.
  const next = advanceEtDateToNextWeekday(et)
  return {
    state: 'held',
    deliverAt: etWallClockToUtc(next.year, next.month, next.day, PREMARKET_HOUR_ET),
  }
}
