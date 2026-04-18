/**
 * Per-ticker initial values for exposure-type factors (fixed structural characteristics).
 * Momentum, valuation, and macro bias factors start at their default (0) and are updated
 * by the engine (T09) from extracted signals (T07).
 *
 * Values are hand-tuned starting points — see docs/factors.md for rationale.
 */

export type FactorInitialMap = Record<string, number>

export const factorInitialByTicker: Record<string, FactorInitialMap> = {
  // --- Crude tankers ---
  FRO: {
    red_sea_exposure: 0.85, // VLCC + Suezmax, long-haul exposed
    russia_sanctions_beta: 0.75, // Public commentary signals strong beneficiary stance
    balance_sheet_strength: 1.0, // Low leverage post-recapitalization
  },
  DHT: {
    red_sea_exposure: 0.75, // Pure VLCC, less Red Sea routed but benefits from global tonne-miles
    russia_sanctions_beta: 0.4, // Less direct — VLCCs aren't the dark fleet workhorse
    balance_sheet_strength: 1.2, // Very conservative leverage, high cash
  },
  INSW: {
    red_sea_exposure: 0.7,
    russia_sanctions_beta: 0.6,
    balance_sheet_strength: 0.5,
  },
  NAT: {
    red_sea_exposure: 0.7, // Suezmax — directly routed via Suez historically
    russia_sanctions_beta: 0.5,
    balance_sheet_strength: -0.5, // High-payout model, thin cushion
  },
  TNK: {
    red_sea_exposure: 0.65,
    russia_sanctions_beta: 0.55,
    balance_sheet_strength: 0.0,
  },
  OET: {
    red_sea_exposure: 0.8,
    russia_sanctions_beta: 0.6,
    balance_sheet_strength: 0.3,
  },
  CMBT: {
    red_sea_exposure: 0.75,
    russia_sanctions_beta: 0.55,
    balance_sheet_strength: 0.2,
  },

  // --- Product tankers ---
  STNG: {
    red_sea_exposure: 0.9, // LR2 on Arab Gulf → Europe is the classic Red-Sea trade
    russia_sanctions_beta: 0.9, // Product flows most disrupted by Russia sanctions
    balance_sheet_strength: 1.3, // Deleveraged aggressively in 2022–23
  },
  TRMD: {
    red_sea_exposure: 0.8,
    russia_sanctions_beta: 0.95, // MR-heavy, pure product; biggest direct beneficiary
    balance_sheet_strength: 0.8,
  },
  ASC: {
    red_sea_exposure: 0.7,
    russia_sanctions_beta: 0.75,
    balance_sheet_strength: 0.0,
  },
  HAFNI: {
    red_sea_exposure: 0.85,
    russia_sanctions_beta: 0.85,
    balance_sheet_strength: 0.5,
  },

  // --- Mixed / parent ---
  TK: {
    red_sea_exposure: 0.4, // Indirect via TNK + gas assets
    russia_sanctions_beta: 0.35,
    balance_sheet_strength: 0.6,
  },

  // Benchmark — no exposure set; factors irrelevant but rows exist for uniformity
  XLE: {},
}
