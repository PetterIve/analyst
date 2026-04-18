export interface FactorSeed {
  slug: string
  name: string
  description: string
  rangeMin: number
  rangeMax: number
  defaultValue: number
  weight: number
}

export const factorSeeds: ReadonlyArray<FactorSeed> = [
  {
    slug: 'red_sea_exposure',
    name: 'Red Sea exposure',
    description:
      'Structural upside to ticker from sustained Red Sea / Suez disruption forcing Cape-of-Good-Hope routing. Higher = more levered to longer tonne-miles.',
    rangeMin: 0,
    rangeMax: 1,
    defaultValue: 0.5,
    weight: 1.0,
  },
  {
    slug: 'russia_sanctions_beta',
    name: 'Russia sanctions beta',
    description:
      'Beneficiary exposure to tightened G7 price cap / OFAC enforcement against Russian crude + product flows. Higher = gains from dark-fleet erosion and longer-haul legitimate trade.',
    rangeMin: 0,
    rangeMax: 1,
    defaultValue: 0.5,
    weight: 1.0,
  },
  {
    slug: 'vlcc_rate_momentum',
    name: 'VLCC rate momentum',
    description:
      'Directional trend of VLCC spot earnings (TD3C Middle East → China). Positive = rising rates; negative = falling.',
    rangeMin: -2,
    rangeMax: 2,
    defaultValue: 0,
    weight: 1.5,
  },
  {
    slug: 'suezmax_rate_momentum',
    name: 'Suezmax rate momentum',
    description:
      'Directional trend of Suezmax spot earnings (TD20 West Africa → UK-Cont).',
    rangeMin: -2,
    rangeMax: 2,
    defaultValue: 0,
    weight: 1.0,
  },
  {
    slug: 'clean_product_rate_momentum',
    name: 'Clean product rate momentum',
    description:
      'Directional trend of LR2/MR product tanker earnings (TC1/TC2/TC7).',
    rangeMin: -2,
    rangeMax: 2,
    defaultValue: 0,
    weight: 1.5,
  },
  {
    slug: 'balance_sheet_strength',
    name: 'Balance sheet strength',
    description:
      'Company leverage + liquidity relative to peers. Positive = underlevered / cash-rich; negative = stretched.',
    rangeMin: -2,
    rangeMax: 2,
    defaultValue: 0,
    weight: 0.5,
  },
  {
    slug: 'valuation_z',
    name: 'Valuation z-score',
    description:
      'Z-score of current P/NAV or P/E vs 3y rolling history. Negative = cheap (potential long), positive = expensive.',
    rangeMin: -3,
    rangeMax: 3,
    defaultValue: 0,
    weight: 0.5,
  },
  {
    slug: 'opec_supply_bias',
    name: 'OPEC supply bias',
    description:
      'Net direction of OPEC+ supply actions. Positive = cuts (bullish oil, bearish seaborne volumes short-term). Negative = hikes.',
    rangeMin: -2,
    rangeMax: 2,
    defaultValue: 0,
    weight: 1.0,
  },
  {
    slug: 'refinery_dislocation',
    name: 'Refinery dislocation',
    description:
      'Global refining margin stress or major outage impact on product flows. Positive = higher product tanker demand from arb.',
    rangeMin: -2,
    rangeMax: 2,
    defaultValue: 0,
    weight: 0.8,
  },
] as const
