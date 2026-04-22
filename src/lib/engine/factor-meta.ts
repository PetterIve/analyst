/**
 * Decay half-lives (in days) per factor slug. Momentum / macro factors decay
 * toward 0 over time so stale bullish/bearish reads fade if no fresh news
 * reinforces them. Structural and derived factors don't decay — they reflect
 * either a slow-moving exposure (`balance_sheet_strength`) or a deterministic
 * read (`valuation_z`) that should only change when its inputs change.
 *
 * Kept in-code rather than on `factor_definitions` to avoid a migration for a
 * tuning knob we'll adjust through T17 anyway. If T17 settles the choice we
 * can move it to the table then.
 */
export const FACTOR_DECAY_HALF_LIFE_DAYS: Record<string, number | null> = {
  vlcc_rate_momentum: 5,
  suezmax_rate_momentum: 5,
  clean_product_rate_momentum: 5,
  opec_supply_bias: 10,
  refinery_dislocation: 7,
  red_sea_exposure: null,
  russia_sanctions_beta: null,
  balance_sheet_strength: null,
  valuation_z: null,
}

export function decayHalfLifeForSlug(slug: string): number | null {
  return slug in FACTOR_DECAY_HALF_LIFE_DAYS
    ? FACTOR_DECAY_HALF_LIFE_DAYS[slug]
    : null
}
