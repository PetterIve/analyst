/**
 * Event classes — taxonomy of recurring market-moving events for tanker equities.
 *
 * `defaultFactorDeltas` maps factor slug → delta applied when an instance of
 * this class fires. The engine (T09) starts from these defaults and may scale
 * them per-instance based on extracted severity/confidence (T07).
 *
 * Slugs in `defaultFactorDeltas` MUST match real entries in `factorSeeds`
 * (src/server/seed/factors.ts). Unknown slugs are dropped at apply time.
 *
 * Sign convention: positive delta = bullish-for-tankers nudge to that factor.
 *   - `red_sea_exposure` is a structural exposure factor (0..1), so deltas
 *     here are not used; we leave it untouched and rely on the per-ticker
 *     initial state. `vlcc_rate_momentum` etc. ARE moved by these events.
 */

export interface EventClassSeed {
  slug: string
  name: string
  description: string
  defaultFactorDeltas: Record<string, number>
}

export const eventClassSeeds: ReadonlyArray<EventClassSeed> = [
  {
    slug: 'red_sea_attack',
    name: 'Red Sea / Houthi attack',
    description:
      'Houthi missile / drone strike or credible threat against commercial shipping in the southern Red Sea or Bab-el-Mandeb, forcing additional Cape-of-Good-Hope diversions and lifting tonne-miles.',
    defaultFactorDeltas: {
      vlcc_rate_momentum: 0.4,
      suezmax_rate_momentum: 0.6,
      clean_product_rate_momentum: 0.7,
    },
  },
  {
    slug: 'red_sea_ceasefire',
    name: 'Red Sea de-escalation',
    description:
      'Credible ceasefire, halt to Houthi targeting, or resumption of normal Suez transits by major liner / tanker operators. Reverses tonne-mile premium.',
    defaultFactorDeltas: {
      vlcc_rate_momentum: -0.3,
      suezmax_rate_momentum: -0.5,
      clean_product_rate_momentum: -0.6,
    },
  },
  {
    slug: 'russia_sanctions_tighten',
    name: 'Russia sanctions tightening',
    description:
      'Lower G7 price cap, new OFAC SDN designations against tankers / operators / insurers, or stepped-up enforcement (boardings, seizures) reducing dark-fleet capacity.',
    defaultFactorDeltas: {
      vlcc_rate_momentum: 0.2,
      suezmax_rate_momentum: 0.4,
      clean_product_rate_momentum: 0.5,
    },
  },
  {
    slug: 'russia_sanctions_loosen',
    name: 'Russia sanctions loosening',
    description:
      'Cap raise, broad waiver, enforcement pullback, or peace-deal optics that legitimise dark-fleet tonnage and shrink the legitimate-fleet premium.',
    defaultFactorDeltas: {
      vlcc_rate_momentum: -0.2,
      suezmax_rate_momentum: -0.3,
      clean_product_rate_momentum: -0.4,
    },
  },
  {
    slug: 'opec_surprise_cut',
    name: 'OPEC+ surprise production cut',
    description:
      'Unscheduled or larger-than-consensus output cut from OPEC+. Bullish for crude prices but bearish for seaborne crude volumes short-term; product tankers less affected.',
    defaultFactorDeltas: {
      opec_supply_bias: 0.8,
      vlcc_rate_momentum: -0.4,
      suezmax_rate_momentum: -0.3,
    },
  },
  {
    slug: 'opec_surprise_hike',
    name: 'OPEC+ surprise production hike',
    description:
      'Unwind of voluntary cuts faster than guided, or new quota increases. Bearish crude price, bullish seaborne volumes — particularly for VLCCs lifting Middle East barrels.',
    defaultFactorDeltas: {
      opec_supply_bias: -0.8,
      vlcc_rate_momentum: 0.6,
      suezmax_rate_momentum: 0.3,
    },
  },
  {
    slug: 'major_refinery_outage',
    name: 'Major refinery outage',
    description:
      'Unplanned shutdown at a top-30 global refinery (≥200 kbd capacity), creating product arbitrage and longer product-tanker hauls to cover regional shortfalls.',
    defaultFactorDeltas: {
      refinery_dislocation: 0.7,
      clean_product_rate_momentum: 0.5,
    },
  },
  {
    slug: 'suez_disruption',
    name: 'Suez transit disruption (non-Houthi)',
    description:
      'Suez Canal blockage, accident, or capacity restriction unrelated to Houthi activity (e.g. Ever Given style grounding, sandstorm closure, dispute with SCA).',
    defaultFactorDeltas: {
      vlcc_rate_momentum: 0.3,
      suezmax_rate_momentum: 0.5,
      clean_product_rate_momentum: 0.5,
    },
  },
  {
    slug: 'hormuz_escalation',
    name: 'Strait of Hormuz escalation',
    description:
      'Iran-linked seizure, mining, or credible threat against Hormuz transits. Affects ~25% of seaborne crude; war-risk premia spike, route diversions limited (no real alternative).',
    defaultFactorDeltas: {
      vlcc_rate_momentum: 0.8,
      suezmax_rate_momentum: 0.4,
      clean_product_rate_momentum: 0.4,
    },
  },
  {
    slug: 'tanker_earnings_beat',
    name: 'Tanker earnings beat',
    description:
      'Company-level quarterly earnings materially above consensus on EPS or distributable cash. Idiosyncratic to the reporting ticker only.',
    defaultFactorDeltas: {
      balance_sheet_strength: 0.3,
      valuation_z: -0.2,
    },
  },
  {
    slug: 'tanker_earnings_miss',
    name: 'Tanker earnings miss',
    description:
      'Company-level quarterly earnings materially below consensus, or distribution cut. Idiosyncratic to the reporting ticker only.',
    defaultFactorDeltas: {
      balance_sheet_strength: -0.4,
      valuation_z: 0.3,
    },
  },
  {
    slug: 'dark_fleet_crackdown',
    name: 'Dark-fleet enforcement action',
    description:
      'Coordinated action against shadow-fleet tankers — Western insurer pull-out, port-state control sweeps, mass SDN listings, or P&I club expulsions — shrinking effective dark-fleet capacity.',
    defaultFactorDeltas: {
      russia_sanctions_beta: 0.0,
      vlcc_rate_momentum: 0.3,
      suezmax_rate_momentum: 0.4,
      clean_product_rate_momentum: 0.5,
    },
  },
  {
    slug: 'china_demand_shock',
    name: 'China crude demand shock',
    description:
      'Material upside (refinery restart, stockpiling push, stimulus) or downside (lockdown, refinery throughput cut, teapot quota pull) surprise to Chinese crude imports. Direction encoded per-instance via signed factor deltas at apply time.',
    defaultFactorDeltas: {
      vlcc_rate_momentum: 0.5,
      suezmax_rate_momentum: 0.2,
    },
  },
] as const
