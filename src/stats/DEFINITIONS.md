# Cash statistic definitions, v0.3.0

All calculations use immutable **completed** canonical cash hand records and session clocks. Imported study records, active pots, wallet edits/reset epochs, buy-ins/top-ups and cashouts never enter hand profit. Tournament statistics will have a separate namespace; no tournament cash rate or EV is fabricated.

- Profit: sum Hero ending stack minus starting stack, once per hand. Duplicate hand IDs are rejected.
- BB/100: `100 × sum(hand net / hand-specific BB) / hand count`. Mixed stakes are explicitly flagged and can be viewed separately.
- App-clock profit/hour: settled profit divided by actual recorded active milliseconds × 3,600,000. Controller excludes explicit pause, hidden and closed time. Playback speed affects simulator rates; no hypothetical live earning claim.
- Sessions won/lost/even count only closed sessions by their settled hand profit, excluding transfers.
- VPIP: hands with voluntary preflop call/raise over hands with an actual voluntary preflop decision. Forced blind/ante-only entries and walks with no decision are excluded.
- PFR: hands raised preflop over hands with a legal preflop raise opportunity; includes a legal short all-in. The opportunity-adjusted denominator is deliberately disclosed instead of silently dividing by every deal.
- 3-bet: hands Hero raises after one prior preflop raise over hands Hero can legally raise at that point. Count once per hand. A forced all-in/closed-raise turn is no opportunity.
- Fold-to-3-bet: hands Hero folds as original opener facing the first re-raise, before a fourth bet, over hands where that response is actually available. Already-all-in openers excluded.
- WTSD: Hero reaches showdown / Hero sees flop. Hero preflop folds are excluded even when others run out the board.
- W$SD: positive pot award at Hero showdown / Hero showdowns; split pots count. This is not positive-net-hand frequency.
- WWSF: any positive pot award after seeing flop / Hero saw flop; includes uncontested postflop wins and split pots.

Pre-action public frames establish legal opportunity metadata, including all-in/reopening limits. Missing such frames makes the corresponding hand unavailable for preflop rates, with coverage reported; it is not counted as a zero. Showdown eligibility is taken from engine-revealed hand labels, never hidden opponent cards.

Rake paid is shown as **contributed attribution**, not a separate financial debit: allocate hand rake proportional to each post-refund total commitment, floor each share, then allocate remaining cents clockwise after the button among contributors. Sum equals exact engine rake. Hand net already includes rake. This reporting convention differs from winner-paid and site reward attribution and is explicitly named.

Position reports use physical order after BB with BTN, SB, BB and late-position labels CO/HJ/LJ, then UTG/UTG+n; heads-up button is BTN/SB. Group by stakes and exact seat-count/rules/rake configuration. Opponent private construction profiles never drive Hero statistics.

Each percentage exposes numerator, denominator and descriptive 95% Wilson interval. Fewer than 100 opportunities is INSUFFICIENT_SAMPLE; zero denominator is null/NO_OPPORTUNITIES, never 0%. Within-session observations can be correlated, so intervals may be too narrow and are not a skill confidence guarantee. No invented EV, real-world income or external human calibration claim.

## Career and snapshot statistics (Phase 2, 2026-11-23)

Separate namespace from the cash definitions above. Career statistics are pure
projections of records the games already keep; they never write game state.

- Career totals per game: cash (completed saved hands), tournaments (saved event
  results), blackjack (saved rounds with a bet), Omaha (saved hand records),
  slots (the slots save's per-machine records), roulette/craps/baccarat/races
  (the casino save's per-game records). A game with no record reports zero;
  nothing is back-filled or estimated. Slots and casino saves keep no start
  date, so "career since" is the earliest dated archive entry (cash hand start
  or tournament finish) and is labelled as device evidence, not a promise.
- Rates for slots and the casino games rest on the recent rounds those saves
  keep (last 30 spins; last 60 rounds per casino game), as result per spin/round
  against the stake, with the same 95% interval discipline as the other games.
  Their totals are all-time even though their rates are recent-window.
- Wagered is reported only where the game tracks stakes (tournaments,
  blackjack, slots, casino games). Cash and Omaha buy-ins are table transfers,
  not wagers, so no wagered figure is shown for them.
- A snapshot is a named, dated copy of the career aggregates in a separate
  versioned on-device record. Resetting the counters stores a baseline (the
  aggregates plus archive cursors); period statistics are career minus
  baseline. A reset never deletes archives, game records, snapshots or career
  totals, and clearing the baseline restores the career as the current view.
- Biggest-win records are career-only. A period biggest cannot be derived from
  aggregates, so period views show none rather than inventing one.
