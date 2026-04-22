import type { FactorDef } from './types'

/**
 * Exponential decay of a factor toward 0 given its half-life.
 *
 * value(t+Δt) = value(t) × 0.5^(Δt / halfLifeDays)
 *
 * Structural factors (`decayHalfLifeDays === null`) don't decay — they
 * represent slow-moving exposures that should only change on real news.
 */
export function decayFactorValue(
  factor: FactorDef,
  currentValue: number,
  elapsedMs: number,
): number {
  if (factor.decayHalfLifeDays === null) return currentValue
  if (elapsedMs <= 0) return currentValue
  const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24)
  const decayFactor = Math.pow(0.5, elapsedDays / factor.decayHalfLifeDays)
  const next = currentValue * decayFactor
  if (Math.abs(next) < 1e-6) return 0
  return next
}
