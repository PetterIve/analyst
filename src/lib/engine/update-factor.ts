import type { FactorDef } from './types'

export interface FactorMutation {
  tickerId: number
  factorId: number
  oldValue: number
  newValue: number
  delta: number
  reason: string
}

/**
 * Compute a clamped factor update. Pure so the trigger/simulation paths can
 * reuse it without touching the DB.
 *
 * `appliedDelta` is what actually moved the value — may differ from `delta`
 * when clamping bites at either edge of the factor's range.
 */
export function computeFactorUpdate(
  tickerId: number,
  factor: FactorDef,
  currentValue: number,
  delta: number,
  reason: string,
): FactorMutation {
  const rawNext = currentValue + delta
  const newValue = Math.min(factor.rangeMax, Math.max(factor.rangeMin, rawNext))
  const appliedDelta = newValue - currentValue
  return {
    tickerId,
    factorId: factor.id,
    oldValue: currentValue,
    newValue,
    delta: appliedDelta,
    reason,
  }
}
