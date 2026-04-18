# Factor taxonomy

The factor model is how the system turns "things that happened" into a per-ticker score.
Every factor has: a slug, a value range, a default starting value, and a weight in the
composite bull/bear score.

Composite score (used by T09 alert engine):

```
long_score(ticker)  = Σ(factor_value × factor_weight)  # positive factors push long
short_score(ticker) = -long_score(ticker)              # symmetric for shorts
```

An alert fires when `|score|` crosses a threshold **and** at least N supporting event
candidates have arrived within a time window (see T09 for the trigger logic itself).

## Factors (initial set — tunable via `/admin/factors`)

| slug | range | default | weight | kind |
|---|---|---|---|---|
| `red_sea_exposure` | 0 → 1 | 0.5 | 1.0 | structural (per ticker) |
| `russia_sanctions_beta` | 0 → 1 | 0.5 | 1.0 | structural (per ticker) |
| `vlcc_rate_momentum` | -2 → +2 | 0 | 1.5 | momentum |
| `suezmax_rate_momentum` | -2 → +2 | 0 | 1.0 | momentum |
| `clean_product_rate_momentum` | -2 → +2 | 0 | 1.5 | momentum |
| `balance_sheet_strength` | -2 → +2 | 0 | 0.5 | structural (slow-moving) |
| `valuation_z` | -3 → +3 | 0 | 0.5 | derived (from prices) |
| `opec_supply_bias` | -2 → +2 | 0 | 1.0 | macro |
| `refinery_dislocation` | -2 → +2 | 0 | 0.8 | macro |

### Why these weights?

- **Momentum factors (1.5):** day-rate trajectory is the single strongest short-run
  driver of tanker equity returns. VLCC + clean product carry the most earnings delta.
- **Red Sea + Russia sanctions (1.0):** large, durable re-routings that have moved the
  group 20–40% in the 2023–2025 window. Weighted equally because they're partly
  overlapping narratives.
- **Suezmax momentum + OPEC bias (1.0):** meaningful but secondary.
- **Refinery dislocation (0.8):** matters mostly for product tankers, partially
  captured by `clean_product_rate_momentum` — hence slightly under-weighted to avoid
  double-counting.
- **Balance sheet + valuation (0.5):** slow-moving; bias rather than trigger. Kept
  in the composite so equal-signal names are ranked by quality + cheapness.

## Per-ticker initial exposures

Structural factors (`red_sea_exposure`, `russia_sanctions_beta`, `balance_sheet_strength`)
are set per-ticker in [`src/server/seed/factor-initial-state.ts`](../src/server/seed/factor-initial-state.ts).
Everything else starts at `defaultValue`.

Key structural reads:

- **FRO / OET / HAFNI / STNG / TRMD** — highest `red_sea_exposure` and
  `russia_sanctions_beta`; pure-play operators in the affected lanes.
- **DHT / NAT** — high `red_sea_exposure` via VLCC/Suezmax but lower
  `russia_sanctions_beta` (not the dark-fleet workhorses).
- **STNG / FRO / DHT** — strongest balance sheets; survive low-rate windows best.
- **NAT** — negative `balance_sheet_strength` due to high-payout model leaving thin
  cushion.
- **TK** — discounted exposure; parent of TNK with gas assets diluting pure tanker beta.

## Ticker universe

13 names: 7 crude (FRO, DHT, INSW, NAT, TNK, OET, CMBT) + 4 pure product (STNG, TRMD,
ASC, HAFNI) + 1 mixed parent (TK) + 1 benchmark (XLE — Energy Select Sector SPDR,
used for beta-adjusted outcome tracking in T13, not an alert target).

ETF selection: XLE was preferred over tanker-specific proxies (none exist as pure ETFs)
or dry-bulk indices (BDRY — wrong segment). XLE tracks broad energy equity and is the
least-bad liquid benchmark for risk-adjusted tanker returns.

## Tuning workflow

1. Pull up `/admin/factors` → adjust a weight.
2. Commit to DB (the mutation happens on blur / Enter).
3. Next engine tick (T09) uses the new weights for composite-score computation. No
   redeploy needed.
4. Track which weight changes correlate with alert precision via T15's weekly report.
