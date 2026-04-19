/**
 * Hand-seeded historical event instances (2022–2025) — the empirical base
 * the alert composer cites in every alert ("last N times event class X fired,
 * ticker returned …").
 *
 * Each instance has:
 *   - `occurredAt` — date in YYYY-MM-DD (UTC midnight). Returns are computed
 *     from the next trading day's close, so weekend dates are fine.
 *   - `eventClassSlug` — must match an entry in `eventClassSeeds`.
 *   - `description` — one-line human summary; shown in /admin/events drill-down.
 *   - `sourceUrl` — primary source link, surfaced in the UI for audit.
 *   - `affectedSymbols` — ticker symbols whose returns we compute for this
 *     instance. Use ALL_CRUDE / ALL_PRODUCT / ALL_TANKERS shorthand for
 *     broad-market events; per-company events list one symbol.
 *
 * Approximate dates are fine — compute-returns aligns to the next trading day.
 * The user grows this catalog over time via the /admin/events "Add instance"
 * form; this file is the immutable historical seed.
 */

const ALL_CRUDE = ['FRO', 'DHT', 'NAT', 'OET', 'CMBT', 'INSW', 'TNK'] as const
const ALL_PRODUCT = ['STNG', 'TRMD', 'ASC', 'HAFNI'] as const
const ALL_TANKERS = [...ALL_CRUDE, ...ALL_PRODUCT, 'TK'] as const

export interface EventInstanceSeed {
  occurredAt: string // YYYY-MM-DD
  eventClassSlug: string
  description: string
  sourceUrl: string
  affectedSymbols: ReadonlyArray<string>
}

export const eventInstanceSeeds: ReadonlyArray<EventInstanceSeed> = [
  // --- Red Sea attacks ---
  {
    occurredAt: '2023-11-19',
    eventClassSlug: 'red_sea_attack',
    description: 'Houthi forces hijack the Galaxy Leader car carrier in the southern Red Sea — first major Israel-linked seizure.',
    sourceUrl: 'https://www.reuters.com/world/middle-east/israel-linked-cargo-ship-seized-by-yemens-houthis-red-sea-officials-say-2023-11-19/',
    affectedSymbols: ALL_TANKERS,
  },
  {
    occurredAt: '2023-12-15',
    eventClassSlug: 'red_sea_attack',
    description: 'Maersk and Hapag-Lloyd halt Suez transits after Houthi missile strikes on Maersk Hangzhou and other vessels.',
    sourceUrl: 'https://www.reuters.com/business/maersk-pauses-all-container-shipments-through-red-sea-after-houthi-attack-2023-12-15/',
    affectedSymbols: ALL_TANKERS,
  },
  {
    occurredAt: '2024-01-12',
    eventClassSlug: 'red_sea_attack',
    description: 'US and UK launch coordinated air strikes on Houthi targets in Yemen; conflict escalates and shipping diversions deepen.',
    sourceUrl: 'https://www.reuters.com/world/middle-east/us-uk-strikes-yemen-after-houthi-red-sea-attacks-2024-01-12/',
    affectedSymbols: ALL_TANKERS,
  },
  {
    occurredAt: '2024-03-06',
    eventClassSlug: 'red_sea_attack',
    description: 'Houthi missile strikes True Confidence in the Gulf of Aden; first fatalities of the campaign.',
    sourceUrl: 'https://www.reuters.com/world/middle-east/missile-strike-bulk-carrier-gulf-aden-causes-casualties-uk-agency-2024-03-06/',
    affectedSymbols: ALL_TANKERS,
  },
  {
    occurredAt: '2024-06-12',
    eventClassSlug: 'red_sea_attack',
    description: 'Houthi USV strike sinks the bulk carrier Tutor in the Red Sea — first vessel sunk in the campaign.',
    sourceUrl: 'https://www.reuters.com/world/middle-east/greek-owned-bulk-carrier-tutor-sinks-after-houthi-attack-eu-mission-says-2024-06-18/',
    affectedSymbols: ALL_TANKERS,
  },
  {
    occurredAt: '2024-08-21',
    eventClassSlug: 'red_sea_attack',
    description: 'Houthi attack on Greek-flagged tanker Sounion leaves it ablaze and adrift, leaking crude — major environmental scare.',
    sourceUrl: 'https://www.reuters.com/world/middle-east/greek-flagged-oil-tanker-sounion-attacked-red-sea-2024-08-21/',
    affectedSymbols: ALL_TANKERS,
  },

  // --- Red Sea ceasefire / de-escalation ---
  {
    occurredAt: '2025-01-19',
    eventClassSlug: 'red_sea_ceasefire',
    description: 'Houthi leadership pledges to limit strikes to Israel-linked vessels following the Gaza ceasefire — first credible de-escalation signal.',
    sourceUrl: 'https://www.reuters.com/world/middle-east/yemens-houthis-say-they-will-limit-red-sea-attacks-israel-linked-ships-2025-01-19/',
    affectedSymbols: ALL_TANKERS,
  },
  {
    occurredAt: '2025-05-06',
    eventClassSlug: 'red_sea_ceasefire',
    description: 'US announces ceasefire with the Houthis brokered via Oman; Houthis to halt attacks on US shipping.',
    sourceUrl: 'https://www.reuters.com/world/middle-east/trump-says-houthis-have-capitulated-us-strikes-will-stop-2025-05-06/',
    affectedSymbols: ALL_TANKERS,
  },

  // --- Russia sanctions tightening ---
  {
    occurredAt: '2022-12-05',
    eventClassSlug: 'russia_sanctions_tighten',
    description: 'G7 + EU $60/bbl price cap on Russian crude takes effect alongside the EU seaborne crude embargo.',
    sourceUrl: 'https://www.reuters.com/business/energy/russian-oil-price-cap-takes-effect-2022-12-05/',
    affectedSymbols: ALL_TANKERS,
  },
  {
    occurredAt: '2023-02-05',
    eventClassSlug: 'russia_sanctions_tighten',
    description: 'G7 product-price caps ($100 premium / $45 discount) and EU product embargo take effect, reshaping diesel + naphtha trade flows.',
    sourceUrl: 'https://www.reuters.com/business/energy/eu-russian-oil-product-ban-price-cap-take-effect-2023-02-05/',
    affectedSymbols: [...ALL_PRODUCT, ...ALL_CRUDE],
  },
  {
    occurredAt: '2023-10-12',
    eventClassSlug: 'russia_sanctions_tighten',
    description: 'First OFAC SDN designations against tankers carrying Russian crude above the price cap (Yasa Golden Bosphorus, Lumber).',
    sourceUrl: 'https://home.treasury.gov/news/press-releases/jy1798',
    affectedSymbols: ALL_TANKERS,
  },
  {
    occurredAt: '2024-02-23',
    eventClassSlug: 'russia_sanctions_tighten',
    description: 'OFAC adds Sovcomflot subsidiaries and 14 of its tankers to the SDN list as part of the second-anniversary Russia sanctions package.',
    sourceUrl: 'https://home.treasury.gov/news/press-releases/jy2117',
    affectedSymbols: ALL_TANKERS,
  },
  {
    occurredAt: '2024-08-23',
    eventClassSlug: 'russia_sanctions_tighten',
    description: 'UK sanctions 25 additional dark-fleet tankers, doubling its previous list and tightening insurance enforcement.',
    sourceUrl: 'https://www.gov.uk/government/news/uk-sanctions-25-tankers-in-russias-shadow-fleet',
    affectedSymbols: ALL_TANKERS,
  },
  {
    occurredAt: '2025-01-10',
    eventClassSlug: 'russia_sanctions_tighten',
    description: 'Outgoing Biden administration imposes the largest Russia energy package to date — 183 tankers, Gazprom Neft, Surgutneftegas, plus oilfield services.',
    sourceUrl: 'https://home.treasury.gov/news/press-releases/jy2777',
    affectedSymbols: ALL_TANKERS,
  },

  // --- Russia sanctions loosening ---
  {
    occurredAt: '2025-02-12',
    eventClassSlug: 'russia_sanctions_loosen',
    description: 'Trump-Putin call signals Ukraine peace negotiations; market begins pricing in eventual sanctions easing and dark-fleet legitimisation.',
    sourceUrl: 'https://www.reuters.com/world/trump-putin-agree-immediate-talks-ukraine-2025-02-12/',
    affectedSymbols: ALL_TANKERS,
  },

  // --- OPEC surprise cut ---
  {
    occurredAt: '2022-10-05',
    eventClassSlug: 'opec_surprise_cut',
    description: 'OPEC+ announces surprise 2 mbd headline output cut (~1.1 mbd actual) at Vienna ministerial meeting.',
    sourceUrl: 'https://www.reuters.com/business/energy/opec-set-cut-oil-output-by-up-2-million-bpd-deepest-pandemic-2022-10-05/',
    affectedSymbols: ALL_TANKERS,
  },
  {
    occurredAt: '2023-04-02',
    eventClassSlug: 'opec_surprise_cut',
    description: 'Voluntary OPEC+ cut of 1.16 mbd announced outside the regular meeting cycle, led by Saudi Arabia and UAE.',
    sourceUrl: 'https://www.reuters.com/business/energy/saudi-arabia-other-opec-producers-announce-voluntary-oil-output-cuts-2023-04-02/',
    affectedSymbols: ALL_TANKERS,
  },
  {
    occurredAt: '2023-06-04',
    eventClassSlug: 'opec_surprise_cut',
    description: 'Saudi Arabia announces an additional unilateral 1 mbd cut for July, on top of the existing voluntary cuts.',
    sourceUrl: 'https://www.reuters.com/business/energy/saudi-arabia-extends-1-mln-bpd-voluntary-oil-output-cut-july-2023-06-04/',
    affectedSymbols: ALL_TANKERS,
  },
  {
    occurredAt: '2024-03-03',
    eventClassSlug: 'opec_surprise_cut',
    description: 'OPEC+ extends voluntary 2.2 mbd cuts through Q2 2024 — longer than market consensus expected.',
    sourceUrl: 'https://www.reuters.com/business/energy/opec-extends-voluntary-oil-output-cuts-q2-2024-03-03/',
    affectedSymbols: ALL_TANKERS,
  },

  // --- OPEC surprise hike ---
  {
    occurredAt: '2024-06-02',
    eventClassSlug: 'opec_surprise_hike',
    description: 'OPEC+ unveils plan to gradually unwind 2.2 mbd voluntary cuts starting October — earlier than the market expected.',
    sourceUrl: 'https://www.reuters.com/business/energy/opec-extends-deep-oil-output-cuts-into-2025-2024-06-02/',
    affectedSymbols: ALL_TANKERS,
  },
  {
    occurredAt: '2025-04-03',
    eventClassSlug: 'opec_surprise_hike',
    description: 'OPEC+ surprises with accelerated unwind of voluntary cuts — 411 kbd added for May vs ~135 kbd expected.',
    sourceUrl: 'https://www.reuters.com/business/energy/eight-opec-countries-agree-accelerate-oil-output-hikes-2025-04-03/',
    affectedSymbols: ALL_TANKERS,
  },

  // --- Major refinery outage ---
  {
    occurredAt: '2024-02-01',
    eventClassSlug: 'major_refinery_outage',
    description: 'BP Whiting refinery (435 kbd, largest US Midwest) goes offline after a power outage; ~3-week outage tightens Midwest gasoline supply.',
    sourceUrl: 'https://www.reuters.com/business/energy/bp-whiting-indiana-refinery-shut-after-power-outage-2024-02-01/',
    affectedSymbols: ALL_PRODUCT,
  },
  {
    occurredAt: '2024-03-13',
    eventClassSlug: 'major_refinery_outage',
    description: 'Cumulative Ukrainian drone strikes on Russian refineries take an estimated ~900 kbd (14% of capacity) offline, lifting global product arbs.',
    sourceUrl: 'https://www.reuters.com/world/europe/ukrainian-drone-strikes-knock-out-14-russian-oil-refining-capacity-source-2024-03-22/',
    affectedSymbols: ALL_PRODUCT,
  },

  // --- Hormuz escalation ---
  {
    occurredAt: '2023-04-27',
    eventClassSlug: 'hormuz_escalation',
    description: 'Iran seizes the Suezmax Advantage Sweet in the Gulf of Oman in retaliation for a US Marshall Islands seizure of an Iranian-laden tanker.',
    sourceUrl: 'https://www.reuters.com/world/middle-east/iran-seizes-oil-tanker-gulf-oman-after-us-court-ruling-tanker-tracker-2023-04-27/',
    affectedSymbols: ALL_TANKERS,
  },
  {
    occurredAt: '2024-04-13',
    eventClassSlug: 'hormuz_escalation',
    description: 'IRGC commandos seize the MSC Aries near the Strait of Hormuz hours before Iran launches direct missile/drone strikes against Israel.',
    sourceUrl: 'https://www.reuters.com/world/middle-east/iran-seizes-container-ship-near-strait-hormuz-tasnim-2024-04-13/',
    affectedSymbols: ALL_TANKERS,
  },
  {
    occurredAt: '2025-06-13',
    eventClassSlug: 'hormuz_escalation',
    description: 'Israel strikes Iranian nuclear and military sites; Iran retaliates and Hormuz war-risk premia spike on transit-closure speculation.',
    sourceUrl: 'https://www.reuters.com/world/middle-east/israel-strikes-iran-nuclear-sites-2025-06-13/',
    affectedSymbols: ALL_TANKERS,
  },

  // --- Tanker earnings ---
  {
    occurredAt: '2024-02-29',
    eventClassSlug: 'tanker_earnings_beat',
    description: 'Scorpio Tankers Q4 2023 — record TCE rates and aggressive deleveraging beat consensus on EPS and capital returns.',
    sourceUrl: 'https://www.scorpiotankers.com/news/press-releases/',
    affectedSymbols: ['STNG'],
  },
  {
    occurredAt: '2024-08-08',
    eventClassSlug: 'tanker_earnings_beat',
    description: 'DHT Holdings Q2 2024 beats on VLCC TCE rates and reaffirms the variable distribution policy.',
    sourceUrl: 'https://www.dhtankers.com/index.php?id=455',
    affectedSymbols: ['DHT'],
  },
  {
    occurredAt: '2025-02-26',
    eventClassSlug: 'tanker_earnings_miss',
    description: 'Frontline Q4 2024 misses as VLCC + Suezmax rates softened from H1 highs and the Russian dark-fleet absorbed marginal demand.',
    sourceUrl: 'https://www.frontline.bm/news-and-media/press-releases/',
    affectedSymbols: ['FRO'],
  },

  // --- Dark-fleet enforcement ---
  {
    occurredAt: '2024-12-16',
    eventClassSlug: 'dark_fleet_crackdown',
    description: 'EU 15th sanctions package targets ~52 additional shadow-fleet vessels and tightens insurance / flag-of-convenience enforcement.',
    sourceUrl: 'https://www.consilium.europa.eu/en/press/press-releases/2024/12/16/russia-s-war-of-aggression-against-ukraine-eu-adopts-15th-package-of-economic-and-individual-restrictive-measures/',
    affectedSymbols: ALL_TANKERS,
  },

  // --- China demand shock ---
  {
    occurredAt: '2022-04-01',
    eventClassSlug: 'china_demand_shock',
    description: 'Shanghai enters full COVID lockdown — bearish shock to Chinese crude imports and refinery throughput through Q2.',
    sourceUrl: 'https://www.reuters.com/world/china/shanghai-locks-down-half-city-mass-covid-19-testing-2022-03-27/',
    affectedSymbols: ALL_TANKERS,
  },
  {
    occurredAt: '2023-01-08',
    eventClassSlug: 'china_demand_shock',
    description: 'China formally drops border controls and quarantine, marking the end of Zero-COVID and a bullish reset for crude demand expectations.',
    sourceUrl: 'https://www.reuters.com/world/china/china-reopens-borders-grand-covid-finale-2023-01-08/',
    affectedSymbols: ALL_TANKERS,
  },
  {
    occurredAt: '2024-09-24',
    eventClassSlug: 'china_demand_shock',
    description: 'PBoC + Politburo announce broad stimulus package (rate cuts, mortgage easing, equity-market support) — markets price in firmer Chinese crude demand.',
    sourceUrl: 'https://www.reuters.com/world/china/china-cuts-key-rates-unveils-stimulus-measures-2024-09-24/',
    affectedSymbols: ALL_TANKERS,
  },
] as const
