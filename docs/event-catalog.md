# Event catalog

The event catalog is the empirical backbone of the alert engine: every alert
cites historical comparable events and their realised forward returns. This
document explains the taxonomy choices in `src/server/seed/event-classes.ts`
and lists the historical instances seeded in `src/server/seed/event-instances.ts`.

## Design choices

**Granularity (~13 classes).** Too few classes blur distinct catalysts
(Houthi attacks vs OPEC decisions move tankers very differently). Too many
leaves each class with <3 historical samples, making base rates noise. We
target 8–15 classes; the seed currently ships 13.

**Direction encoded in the class, not the instance.** `red_sea_attack` and
`red_sea_ceasefire` are two classes rather than one signed class — keeps the
default factor deltas simple and lets the UI surface symmetric stats. The
exception is `china_demand_shock`, which carries both directions in one class
because positive/negative shocks share a similar tonne-mile mechanism but the
sample is too small to split.

**Default factor deltas live on the class.** The engine (T09) reads
`event_classes.default_factor_deltas` and applies them when an instance fires,
optionally scaled by the per-instance severity / confidence extracted by T07.
Slugs in the JSON map to `factor_definitions.slug`. Unknown slugs are dropped
silently.

**Manual seed source.** The 30+ historical instances are hand-drafted from
public knowledge (Reuters, Treasury press releases, Council of the EU, etc.).
This is the bootstrap; the operator grows the catalog over time via the
`/admin/events/[slug]` "Add instance" form, which immediately recomputes
forward returns from `prices_daily`.

**Returns: trade-day-aligned, total-return.** `compute-returns.ts` finds the
first trading day at-or-after `occurredAt` (anchor = day 0), then takes
`adjClose[t+1] / adjClose[0] - 1` for d1/d5/d20. Adjusted close handles
dividends + splits. Weekend / holiday event dates are handled naturally.

**Low-N flag.** Classes with fewer than 5 instances are flagged in the admin
UI and the alert composer (T11) is expected to add a "low sample size" caveat
when citing them.

## Classes

| Slug | Direction (for tankers) | Headline factors moved |
|---|---|---|
| `red_sea_attack` | bullish | rate momentum (all sub-segments) |
| `red_sea_ceasefire` | bearish | rate momentum (all sub-segments) |
| `russia_sanctions_tighten` | bullish | rate momentum (esp. product) |
| `russia_sanctions_loosen` | bearish | rate momentum |
| `opec_surprise_cut` | mixed (bullish oil, bearish seaborne short-term) | opec_supply_bias up, vlcc/suezmax down |
| `opec_surprise_hike` | mixed (bearish oil, bullish seaborne) | opec_supply_bias down, vlcc up |
| `major_refinery_outage` | bullish (product) | refinery_dislocation, clean_product momentum |
| `suez_disruption` | bullish | rate momentum |
| `hormuz_escalation` | strongly bullish (limited reroute capacity) | vlcc_rate_momentum up sharply |
| `tanker_earnings_beat` | bullish (idiosyncratic) | balance_sheet_strength, valuation_z |
| `tanker_earnings_miss` | bearish (idiosyncratic) | balance_sheet_strength, valuation_z |
| `dark_fleet_crackdown` | bullish | rate momentum |
| `china_demand_shock` | direction-per-instance | vlcc_rate_momentum, suezmax_rate_momentum |

## Class rationale (sample)

### `red_sea_attack`
The 2023+ Houthi campaign forced container + tanker operators to divert
around the Cape of Good Hope, lengthening the average tanker voyage by
~30% on Suez-routed trades. Each fresh attack ratchets the perceived
duration of the disruption, supporting forward TCE rates.

### `russia_sanctions_tighten` vs `dark_fleet_crackdown`
The two overlap meaningfully — most tightening waves include dark-fleet SDN
designations. We split them because the *mechanism* differs: tightening is
typically a price-cap or product-cap event (re-prices Russian crude /
products globally), while a dark-fleet crackdown shrinks the supply of
shadow tonnage and lifts mainstream-fleet utilisation directly. The
defaults reflect the difference: `russia_sanctions_tighten` has a small
bias because it can backfire (Russia finds new buyers); `dark_fleet_crackdown`
is more directly bullish for legitimate-fleet rates.

### `opec_surprise_cut` (mixed-sign)
A surprise cut is bullish for crude prices but bearish for *seaborne crude
volumes* short-term: Saudi/OPEC barrels are the main VLCC long-haul cargo.
The default deltas encode this: `opec_supply_bias` up, `vlcc_rate_momentum`
down. The sample size per side (`opec_surprise_cut` vs `opec_surprise_hike`)
will stay sparse — these are infrequent. Expect the alert composer to flag
LOW-N when citing them.

## Maintenance

- Add new instances via `/admin/events/[slug]` as catalysts happen — the
  form recomputes forward returns immediately.
- After a price-data backfill (or a fresh ticker is added to the universe),
  click **Recompute returns** on the catalog page to refresh `ticker_returns`
  for all instances.
- If you change a class's `default_factor_deltas` in the seed file, the
  change applies to *future* engine runs only; historical alerts retain the
  deltas they cited at fire time.
