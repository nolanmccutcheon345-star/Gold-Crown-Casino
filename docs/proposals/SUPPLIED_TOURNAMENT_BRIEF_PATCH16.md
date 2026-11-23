# Poker Night AI — tournament design brief

For: ChatGPT (engine, ledger, saved data, tests) and the owner.
From: Claude (design and interface patches).
Based on: the Version 26 source export plus patches 8–15, and the project's own
`R1_REQUIREMENTS.csv` and `BACKLOG_86.csv`.

## 1. Owner decisions already made

| Decision | Choice |
| --- | --- |
| Build order | Tournaments first, blackjack after |
| Tournament target | Multi-table tournament (MTT) |
| Who builds | Claude designs and writes interface patches; ChatGPT builds engine, ledger and save code inside its existing test and release process |
| Money | Tournaments and blackjack each get a balance separate from the cash-game bankroll |

## 2. What "multi-table first" means in practice

The project already has tournament requirements, and it stages them:

| Stage in `R1_REQUIREMENTS.csv` | Requirements |
| --- | --- |
| R2 single-table tournament | T01–T08, T18, T21, T22, T24, V411, V413, V427, V506, V507, V508 |
| R3 multi-table tournament | T09, T12–T16, T23, V422, V423, V424, V520 |
| Deferred | T10, T11, T17, T19, T20, V425 (rebuys, add-ons, hyper structures, knockouts) |

Every R2 item is also needed by an MTT: blind levels, big-blind ante, dead button, heads-up
transition, bust-out order, entry accounting, payouts, save and resume. An MTT's final table
*is* a single-table tournament. So the MTT is the target, and a playable single table is the
first milestone on the way to it, not a different product.

## 3. Version 1 scope

| In | Out for now |
| --- | --- |
| No-Limit Hold'em freezeout (one entry, no rebuys) | Late registration and re-entry (T09, T12): build after the first playable MTT |
| Fields of 6 to 90 players by event (see section 8), nine per table | Knockouts and progressive knockouts (T19, T20, V425) |
| Big-blind ante, 2026 TDA dead-button profile (V411, V413) | Rebuys, add-ons, hyper-turbo (T10, T11, T17) |
| Fifteen event presets, each at live pace or faster | Satellites, deal-making, ICM study (FUT077, FUT078, FUT085) |
| Background tables that play real hands (T13) | Fields above 90, until section 5's cost is measured |
| Balancing, table breaking, final table (T14, T15) | |
| Hand-for-hand on the bubble (T16, V422) | |
| Separate tournament balance, ROI results (T06, T22, V427) | |
| Save and resume mid-event (T18) | |

## 4. Core design proposals

### 4.1 One synchronized round instead of a wall clock

Proposal: the event advances in **rounds**. A round is one hand at Hero's table plus exactly one
hand at every other live table. Blind levels change every N rounds, at a hand boundary (T02). N comes from the event's level
length at about 30 hands an hour (`handsPerLevel` in `presets.ts`).

Why:

- V423 and V520 require the same seeds and Hero decisions to give the same event result
  regardless of rendering speed, tab suspension or think time. A round counter has no wall
  clock to diverge.
- Hand-for-hand (T16, V422) is the normal state, not a special mode: no table can ever be
  more than one hand ahead.
- T23 holds by construction: the field shrinks only through simulated eliminations.

Cost: other tables never play faster than Hero's. That is less realistic than a timed event and
far simpler to make correct. A timed mode can be layered on later (T17).

After Hero busts, the remaining rounds run without waiting for input, with a "Skip to result"
control that still plays every hand.

### 4.2 Event model

```
TournamentEvent
  id, rulesVersion, profile          // T24: frozen per event, shown on replay
  entrants[]                         // seat owner, persona seed, entry record
  tables[]                           // table id, seats, button, per-table deck seed stream
  round, level, levelSchedule[]      // SB / BB / BB-ante per level
  prize: { entryTotal, feeTotal, pool, ladder[], paid[] }   // T06, T07
  standings[]                        // T05, V507: bust order with same-hand tie-break
  status: registering | running | hero-out | complete      // T08: complete is terminal
```

Chip identity to assert after every round (V424):
`starting chips x entries = sum of live stacks + chips committed in hands in progress`.

### 4.3 Background tables

- Same engine, same bot policies, separate deck seed per table (T13). No rendering.
- Store each background hand as its seed, starting stacks and resulting stacks, not a full
  hand body. The cash game used about 1.8 MB of storage for 25 full hands; a 45-player event is
  several hundred hands. A background hand can be re-derived from its seed if ever needed.
- Hero's table keeps full hand history as today.

### 4.4 Balancing, breaking, final table

- After each round: if a table can be broken (players fit in the remaining tables), break the
  table with the highest table id and reseat its players by a seeded draw (T14).
- Otherwise move one player at a time from the largest to the smallest table when they differ
  by two or more, taking the player who would next be big blind (a common TDA practice; the
  exact rule belongs in the frozen rules profile).
- Moved players take the blind obligations of the seat they receive under the selected profile.
- At nine players left: redraw seats and button for the final table (T15), and assert no
  player is duplicated or lost and total chips are unchanged.
- Hero can be moved. The interface needs the move as an explicit event (section 6).

### 4.5 Money

- New `tournament` balance, separate from the cash `wallet` (owner decision), with its own ledger event types so cash bb/100 is never touched (T22, V427).
- Entry = buy-in + fee, recorded separately (T06). Prize pool = sum of buy-ins. Ladder pays
  the top 15% of the field, rounded to whole dollars with the remainder to first place, so
  payouts sum exactly to the pool (T07).
- Open point for the owner: whether money can be moved between the cash and tournament
  balances. Recommendation: no transfers in version 1.

### 4.6 Opponents

T21 asks for short-stack and bubble behaviour, labelled as an approximation. Minimum for
version 1: bots receive stack depth in big blinds and players-to-the-money as features; push or
fold ranges below roughly 12 BB; the persona card says "tournament adjustments: designed, not
validated".

## 5. Main technical risk: bot decision cost

From my audit of the cash game: an opponent decision step took a median of 86.8 ms on desktop
and 355.6 ms with the CPU slowed 4x to approximate a phone (slowest 825.8 ms).

A nine-handed hand has roughly 15–25 decisions. Four background tables at phone speed is
therefore on the order of 20–35 seconds of main-thread work **per round** if run as-is. That
would freeze Hero's table.

Options, in the order I would try them:

1. Run background tables in a Web Worker. Hero's table stays responsive; a round's background
   work overlaps Hero's own hand.
2. Profile `bot.prepare` for background use. Range analysis that exists to make decisions
   explainable at Hero's table may not be needed where nobody is watching.
3. Cap version 1 at 27 players (three tables) on phones until measured.

Please measure this before committing to field sizes. It decides whether 45 is realistic.

## 6. Interface (my patches, once the controller exposes the data)

| Screen | Content |
| --- | --- |
| Lobby | Field size, speed, buy-in, payout ladder preview, tournament balance, Register |
| Table header strip | Level, blinds and ante, rounds to next level, players left of entrants, Hero's rank, average stack, Hero's stack in big blinds |
| Table | The existing table and action bar. Stacks can be shown in big blinds |
| Move notice | "Your table broke. You are now at Table 3, Seat 6." Blocks the next deal until acknowledged |
| Bubble and final-table banners | "Hand for hand: 6 players left, 5 paid" |
| Bust-out / result | Finish place, prize, entry cost, net; buttons for Standings, Watch on, New tournament |
| Standings | Live chip counts, bust order, payout ladder with paid places marked |
| Results tab | Tournament section: events, in-the-money rate, total cost, total prizes, ROI (never bb/100) |

Patch 16 delivers the menu (Play, History, Stats, Cashier), the lobby, and all of the screens
above as markup functions with a sample-data preview page. The lobby is live in the app with
registration disabled; the in-event screens wait for the controller.

What I need from the controller for these screens is the `TournamentView` contract in
`src/tournament/view-model.ts`: a tournament view model with level, blinds,
ante, rounds to next level, entrants, players left, places paid, ladder, Hero rank, average
stack, Hero table id and seat, a pending-move record, event status, and a result record.

## 7. Milestones

| # | Milestone | Requirements | Playable? |
| --- | --- | --- | --- |
| M1 | Engine: forced-bet profile (BB ante, level schedule, dead button, heads-up transition), headless single-table freezeout to a unique winner | T01–T05, V411, V413, V506, V507, V508 | No (tests only) |
| M2 | Single-table tournament in the app: lobby, header strip, entry and prize accounting, results, save and resume | T06–T08, T18, T21, T22, T24, V427 | Yes: one table. This is R2 |
| M3 | Multi-table core, headless: background tables, rounds, balancing, table breaking, final table, hand-for-hand, chip identity | T13–T16, T23, V422–V424, V520 | No (tests only) |
| M4 | MTT in the app: move notices, standings, bubble banners, background work off the main thread | — | Yes: fields up to 90. This is R3 |
| M5 | Late registration and re-entry | T09, T12 | Yes |

## 8. Event catalogue (owner decision, 15 November 2026)

The owner asked for realistic structures across home games, casino tournaments and series
events, at low, mid and high stakes. Patch 16 ships them in `src/tournament/presets.ts` with
blind schedules and payout ladders; the lobby already displays them. They replace the single
set of defaults in the first version of this brief.

| Event | Kind | Stakes | Entry (prizes + fee) | Stack | Big blinds | Levels | Ante | Fields offered |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Kitchen-table $20 | home | low | $20 ($20 + $0) | 5,000 | 100 | 15 min = 8 hands | none | 6, 9, 18 |
| Garage game $50 | home | low | $50 ($50 + $0) | 10,000 | 200 | 20 min = 10 hands | none | 9, 18, 27 |
| Home deep stack $100 | home | low | $100 ($100 + $0) | 20,000 | 200 | 20 min = 10 hands | none | 9, 18, 27 |
| Morning daily $65 | casino | low | $65 ($45 + $20) | 15,000 | 75 | 15 min = 8 hands | BB ante | 18, 27, 45 |
| Casino daily $125 | casino | low | $125 ($100 + $25) | 20,000 | 100 | 20 min = 10 hands | BB ante | 18, 27, 45 |
| Nightly deep stack $200 | casino | mid | $200 ($170 + $30) | 20,000 | 100 | 20 min = 10 hands | BB ante | 27, 45, 90 |
| Weekend special $300 | casino | mid | $300 ($260 + $40) | 30,000 | 150 | 30 min = 15 hands | BB ante | 27, 45, 90 |
| Series opener $400 | series | mid | $400 ($340 + $60) | 25,000 | 125 | 30 min = 15 hands | BB ante | 45, 90 |
| Deep stack $600 | series | mid | $600 ($520 + $80) | 30,000 | 150 | 30 min = 15 hands | BB ante | 45, 90 |
| Championship event $1,100 | series | mid | $1,100 ($1,000 + $100) | 30,000 | 150 | 40 min = 20 hands | BB ante | 45, 90 |
| Regional main event $1,700 | series | mid | $1,700 ($1,500 + $200) | 30,000 | 150 | 40 min = 20 hands | BB ante | 45, 90 |
| Tour main event $3,500 | series | high | $3,500 ($3,200 + $300) | 40,000 | 200 | 60 min = 30 hands | BB ante | 45, 90 |
| High stakes $5,000 | series | high | $5,000 ($4,700 + $300) | 50,000 | 250 | 60 min = 30 hands | BB ante | 27, 45, 90 |
| World championship $10,000 | series | high | $10,000 ($9,400 + $600) | 60,000 | 300 | 120 min = 60 hands | BB ante | 45, 90 |
| High roller $25,000 | series | high | $25,000 ($24,000 + $1,000) | 100,000 | 250 | 60 min = 30 hands | BB ante | 18, 27, 45 |

Rules that go with the catalogue:

- Level length converts to hands at about 30 hands an hour; a "Faster" option halves it.
- Home games have no fee and no ante. Casino and series events use a big-blind ante.
- Places paid: about 15% of the field (fixed splits at one table). Whole-dollar prizes that sum
  to the pool.
- Field sizes are capped at 90 until section 5's cost is measured. Real fields for the larger
  events are far bigger; the lobby says so.
- Still open: starting tournament balance, and whether money can move between the cash and
  tournament balances. Recommendation unchanged: a separate balance and no transfers in
  version 1. High-stakes entries (up to $25,000) mean the starting balance or a top-up rule
  needs deciding before registration opens.

## 9. Questions for ChatGPT

1. Does the engine have any forced-bet support beyond two blinds today? Setup shows "Antes and
   straddles remain unavailable", so I assume M1 starts there.
2. Saved data is `schemaVersion: 4` with one `wallet`. A second balance and an event record need
   a schema step and a migration. What is your preferred shape?
3. Can `bot.prepare` run in a Web Worker as written, or does it touch controller state?
4. Is the round model in 4.1 compatible with your recovery checkpoint design, given that a
   round commits several tables at once?

## 10. Blackjack

Parked until M2 ships. It shares almost nothing with the hold'em engine (no opponents, no
betting rounds), so it does not block or depend on tournament work. It will need its own short
brief: rule set (decks, dealer hits or stands on soft 17, blackjack pays 3:2, double and split
rules, surrender), its own balance, and its own table screen.
