# Population Benchmarks — Model Card

Companion to `src/bots/population-benchmarks.ts`. Related defect: **BOT-004**
(DEFECTS.csv) — "Explicit positional ranges and stack sensitivity implemented;
uncalibrated population realism remains open." This card is the population
realism tracking artifact for that defect; it does not close it.

## Calibration status (Phase 5, executed 2026-11-24)

The calibration loop below was executed end-to-end. Reporter runs at
40 blocks × 25 hands per environment, seed base 0x5b000000, before and after
calibration (same seed base so movement is attributable):

- **Before calibration** (benchmarks committed, population untuned):
  **20 of 45** environment-metric pairs inside their bands. Flop c-bet sat at
  10–20% in every pool (bands 40–68) and WTSD at 59–81% (bands 26–36).
- **After calibration**: **35 of 45** pairs inside their bands. Flop c-bet
  44–68%, WTSD 24–32% in four of five pools, VPIP/PFR/3-bet/limp inside or
  within half a point of their bands in nearly every pool.
- **Remaining residuals** (documented, with mechanisms, in the Phase 5
  report): live WWSF ≈ 2 points low in both live pools; online-low PFR
  17.5 vs band 19–23 (the low pool's passive third caps the pool raise
  share); online-mid PFR 17.8 vs 18; online-high 3-bet 7.7 vs 8,
  fold-to-3-bet 66.9 vs 64, flop c-bet a hair over 68, WTSD 23.7 vs 26;
  live-low VPIP 29.5 vs 30; live-mid fold-to-c-bet 56.5 vs 54.
- A seeded lock-in test (`tests/bots/population-calibration.test.ts`)
  asserts every non-residual metric stays in band and no residual degrades
  past its recorded deviation.
- BOT-004 is **MITIGATED** on this evidence, not FIXED: the bands are public
  targets, agreement is descriptive, and the residuals above remain open
  modelling questions.

## Honesty label

The bands in this card are **TARGET bands from public poker knowledge** —
published pool-tendency summaries, public training-site pool reports and
widely cited public ranges. They are **never measured human data**: no hand
histories were collected or fitted, no band is a precise citation of a single
study, and no result produced against these bands may be described as
"calibrated to humans". A simulated rate inside a band means only
"consistent with public pool tendencies". BOT-004 stays open until real
calibration evidence exists.

All rates are percents on a 0–100 scale, using the metric definitions in
`tests/step4c/audit.ts` (`DEFINITIONS`) as implemented by the audit counters.

## Environments

| Key | Preset | Venue | Seats | Shape |
|---|---|---|---|---|
| `live-low` | `low` | live | 9 | Full-ring live low stakes |
| `live-mid` | `mid` | live | 9 | Full-ring live mid stakes |
| `online-low` | `low` | online | 6 | Online 6-max low stakes |
| `online-mid` | `mid` | online | 6 | Online 6-max mid stakes |
| `online-high` | `high` | online | 6 | Online 6-max high stakes |

Preset and seats come from `POOL_ENVIRONMENTS`. Venue drives the archetype
mixture via `flavorWeights(preset, venue)`:

- **Online**: `POPULATION_WEIGHTS[preset]` from `src/bots/profiles.ts`,
  unchanged.
- **Live**: the same preset weights adjusted by documented multipliers
  (`LIVE_FLAVOR_MULTIPLIERS`): mass shifts toward `station` (×2.2),
  `passive-reg` (×2.05) and `fit-or-fold` (×1.35), away from `stronger-reg`
  (×0.3), `lag` (×0.5) and `tag` (×0.62); `nit` ×1.05, `maniac` ×1.1; then
  renormalised to sum 1. Rationale: live pools are publicly observed to hold
  proportionally more loose-passive recreational players and fewer studied
  regulars than online pools. This is a modelling assumption, not a
  measurement. (Multipliers as tuned by the Phase 5 calibration loop —
  see "Calibration status" below.)

## Target bands (percent)

Basis key:

- **L** — Published live-game pool observations and public training-site live
  full-ring tendency summaries.
- **O** — Published online pool database analyses (PokerTracker-style pool
  reports) and public training-site pool tendency summaries.
- **OH** — Published online pool database analyses (PokerTracker-style pool
  reports) for tougher mid/high-stakes pools and public training-site
  summaries.

### live-low (basis L for every row)

| Metric | Band |
|---|---|
| VPIP | 30–42 |
| PFR | 8–15 |
| 3-bet | 2–5 |
| Fold to 3-bet | 45–65 |
| Limp | 14–26 |
| Flop c-bet | 40–58 |
| Fold to c-bet | 38–52 |
| WTSD | 28–36 |
| WWSF | 40–46 |

### live-mid (basis L for every row)

| Metric | Band |
|---|---|
| VPIP | 26–36 |
| PFR | 10–17 |
| 3-bet | 3–6 |
| Fold to 3-bet | 48–66 |
| Limp | 9–20 |
| Flop c-bet | 42–60 |
| Fold to c-bet | 40–54 |
| WTSD | 27–34 |
| WWSF | 41–47 |

### online-low (basis O for every row)

| Metric | Band |
|---|---|
| VPIP | 24–29 |
| PFR | 19–23 |
| 3-bet | 7–10 |
| Fold to 3-bet | 55–70 |
| Limp | 2–8 |
| Flop c-bet | 50–65 |
| Fold to c-bet | 45–58 |
| WTSD | 27–33 |
| WWSF | 43–48 |

### online-mid (basis O for every row)

| Metric | Band |
|---|---|
| VPIP | 22–27 |
| PFR | 18–23 |
| 3-bet | 7–11 |
| Fold to 3-bet | 52–66 |
| Limp | 1–6 |
| Flop c-bet | 52–66 |
| Fold to c-bet | 44–57 |
| WTSD | 27–32 |
| WWSF | 44–49 |

### online-high (basis OH for every row)

| Metric | Band |
|---|---|
| VPIP | 20–25 |
| PFR | 17–22 |
| 3-bet | 8–12 |
| Fold to 3-bet | 50–64 |
| Limp | 0–4 |
| Flop c-bet | 52–68 |
| Fold to c-bet | 42–56 |
| WTSD | 26–32 |
| WWSF | 44–50 |

How the bands were shaped (directional public tendencies, applied uniformly):

- Live pools play looser and more passively than online pools at comparable
  stakes: higher VPIP and limp, lower PFR and 3-bet.
- Online 6-max geometry raises VPIP/PFR relative to full-ring at the same
  skill level, and online pools 3-bet and fold to 3-bets more.
- Higher stakes are tighter and more aggressive at every venue: VPIP and
  limp fall, PFR and 3-bet rise.

## How the reporter uses these bands

`scripts/step5-population-report.ts` simulates seeded 25-hand session blocks
per environment (lineups drawn from `flavorWeights`, persistent stacks,
memory and engine top-ups within a block, reusing the step5a session
machinery), aggregates the audit counters overall and per archetype, computes
rates with the block-clustered estimator (`clusteredRate`), and compares each
benchmark metric against its band: `PASS` inside the band, `OUT` with a
direction (`below`/`above`) outside it. Output is a stdout table plus a JSON
report (`--out`) carrying rates, opportunity counts and verdicts.

## Calibration loop

1. Run the reporter; treat every `OUT` as a modelling question, not a tuning
   order. Check per-archetype rates first — a pool-level miss usually traces
   to one archetype's policy or to the mixture weights.
2. Any change made in response belongs to the bot policy or the documented
   mixture assumptions, is reviewed on its own merits, and is re-measured
   with a fresh reporter run at a new seed base. Bands are **not** edited to
   make a run pass; a band changes only when the public-source picture
   changes, and the change is recorded here.
3. Baseline and follow-up reports are compared by label and seed base so
   movement is attributable. Synthetic-vs-band agreement narrows BOT-004's
   "uncalibrated" gap descriptively; it never converts these targets into
   measured human data.
