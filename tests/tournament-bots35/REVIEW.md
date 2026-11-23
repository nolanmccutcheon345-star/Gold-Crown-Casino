# Version 35 short-stack policy review

`src/tournament/bot-policy.ts` adds `synthetic-tournament-shortstack-1.0.0`, an explicit event-level overlay above the unchanged `synthetic-cash-1.6.0` base profile. Existing events without `tournamentPolicyVersion` use exactly the former policy. Pending decisions must be replayed through the same wrapper and stored event version. The base `BotDecision.policyVersion` continues to identify the underlying profile; `observationHash` is prefixed with the overlay version. Do not edit old events or pending decisions when upgrading.

## Confirmed cause and bounded change

The previous tournament controller reused the cash policy without a tournament short-stack context. In identical unopened nine-player UTG opportunities, the stronger regular folded 1,181 of 1,326 combinations at both 1.5 and 12 BB. The new preflop-only overlay activates for own total street stack <=12 BB and uses effective stack, seat position, limpers, public raises, actual eligible call pricing, caller count, and bounded personality variation. Selected unopened hands shove; responding to raises uses a tighter, price-sensitive calling selection and value reshoves. Free checks remain free checks, and premium pairs do not fold because of a short-stack risk penalty. Above 12 BB and after the flop, base action selection is unchanged.

The score/range thresholds are provisional synthetic design assumptions. Ordinal percentiles are not equity estimates. Explicit assumed opponent range fractions are not calibrated opponent ranges. No Nash, ICM, solver, expert review, or human-data claim is made. No minimum calling quota or Hero-win/loss target is used.

## Executed evidence

`test-results.json`: 25 PASS, 0 FAIL. Typecheck and focused ESLint also passed. Includes eight archetypes in legal engine hands, side-pot pricing exclusion, determinism, no hidden-card property access, old-event compatibility, premiums/weak hands, free checks, seat-identity invariance, position and depth.

`conditional-results.json`: all 1,326 actual starting combinations, one fixed seeded decision per combination per public context, each policy, five stack sizes (1.5/3/6/12/25 BB), UTG unopened/button unopened/facing one 6 BB early-position raise. These are controlled action opportunities, not observed human populations or independent statistical samples of players. Calling a large early-position raise still correctly has a much narrower selected range than opening: this change does not force indiscriminate calling.

| Stack | UTG open shove, before -> after | Button open shove, before -> after | Facing early 6 BB raise, continue before -> after |
|---|---:|---:|---:|
| 1.5 BB | 144 -> 604 | 549 -> 896 | 98 -> 279 |
| 3 BB | 144 -> 555 | 549 -> 854 | 62 -> 198 |
| 6 BB | 144 -> 451 | 549 -> 749 | 44 -> 142 |
| 12 BB | 144 -> 238 | 549 -> 548 | 44 -> 142 |
| 25 BB | 143 -> 143 | 552 -> 552 | 44 -> 44 |

Every table cell has denominator 1,326. “Before” can also include a few flats; counts above show shoves in the unopened columns and total calls+raises when facing a raise. Exact action counts are in JSON.

`full-event-results.json`: three held-out seeds, before and after, engine-only nine-player full events, check/fold Hero, 45,000 chips conserved through every hand. Controlled blinds double every eight hands; this is **not** the shipped preset/controller/UI. Events before: 77/74/68 hands; after: 56/49/56. Hero ranks before: 5/7/3; after: 4/4/4. Heads-up average stacks before: 3.52/3.52/7.03 BB; after: 7.03/no heads-up stage/14.06 BB. One after event jumped from three to one surviving player. Small samples are insufficient to infer robust exploit resistance, profitability or realism. Seed paths diverge once decisions change. The point is fewer blind-dominated endings in these measured cases, not tuning Hero's finish.

## Integration

- Add optional `tournamentPolicyVersion` to TournamentEvent, validate against `supportedTournamentPolicy`.
- Set `TOURNAMENT_BOT_POLICY_VERSION` on newly created events only.
- Use `chooseTournamentDecision(..., event.tournamentPolicyVersion)` in prepare and independent pending replay.
- Preserve the field in redacted event metadata/export. It exposes a version, not private strategy.
- No cash engine, policy files, authoritative chip movement or settlement changed.
