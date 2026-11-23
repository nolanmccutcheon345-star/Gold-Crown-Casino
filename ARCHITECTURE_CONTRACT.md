# AI Texas Hold Em — contract 0.1.0
V7 governs product behavior. The Acceleration Addendum governs execution. Both supplied PDFs and full extracted text are preserved under docs/specs. This repository is new and independent; no Poker MaxEV source or connections.

All values are safe integer cents. Production is single-player client authority with honest application-level isolation, not cryptographic secrecy from developer tools. Engine-only state mutation. Frozen per-hand cash profile. No network poker services.

Stable exports (review before changing):
- src/core/engine.ts: startHand(input: StartHandInput): GameState, legalActions(state): LegalActionSet, applyCommand(state,command): GameState (throws illegal/stale, duplicate decision returns unchanged), projectView(state,heroSeat): HeroViewModel, observeBot(state,seat,policyVersion,decisionId): BotObservation.
- src/core/deck.ts: secureDeck(): Card[] (CSPRNG rejection sampling, fail closed). Deterministic fixtures belong in tests only.
- src/core/evaluator.ts: evaluate(cards:Card[]): number[] (lexicographic best-five rank; larger is better).
- src/bots/policy.ts: defaultProfile(archetype): BotProfile; chooseDecision(observation,profile,random?:()=>number): BotDecision; DecisionCache.getOrCreate(observation,profile): BotDecision. No GameState imports in policy. Production independent crypto sampling. Cache persists via integrator adapter in later G3.
- src/ui/app.ts: mountApp(root:HTMLElement): void. UI may consume above exports only for poker rules; displays raise-to total and additional chips. No second pot engine.
- Tests use engine exports; fixture deck can be constructed by replacing private deck/hole cards in test code only. Any production test-deck injection requires explicit contract review.

Ownership: engine src/core + tests/core; UI src/ui; bots src/bots + tests/bots; verification tests/verification + tests/oracle + tests/browser + .github/workflows. Integrator owns contracts, config, storage, evidence, requirements and final merge. Isolated Git worktrees; never edit another lane's files. Contract changes need integrator review and affected consumers notified.

Phase 0 supported rule profile: transparent practice cash, 2–10 funded seats, no ante/straddle, rake 0 by default. Unsupported room/tournament/variant controls stay unavailable. R1 scope remains intact and unfinished; this is an internal development preview.

## Step 2 additive contract 0.2.0
- Engine exports nextHand(previous: GameState, handId: string): GameState; sole owner of funded-seat selection, cash button/blind advancement and chip carry-forward. UI requests next hand without choosing its positions or stacks.
- HeroViewModel adds uncalledBet and handLabels. pots is now engine-derived during betting as well as settlement; provisional contestable pot tiers exclude the uniquely unmatched excess. uncalledBet labels that pending excess separately. No UI pot algorithm. handLabels exposes only actual legally revealed showdown hands.
- No schema deletion, no new production fixture injection, and no change to tournament deferred scope.

## Step 3 frozen additive contract 0.3.0
Types in src/session/types.ts. Integrator owns session/ and storage/. Engine owner adds topUpTable(previous, seatId, amount, transferId, maxStack): GameState, only after settlement; records distinct external table transfer without rewriting completed hand evidence. nextHand remains authority for deals. Stats owner uses StoredHand public projections and CashSession records; never private profiles for Hero metrics.

SessionController (src/session/controller.ts): constructor optional PersistencePort; data:AppData|null, status:'loading'|'ready'|'readonly'|'error', error:string, busy:boolean; subscribe(listener):unsubscribe; init():Promise<void>; retry():Promise<void>; adjustBankroll(targetCents,note,reset=false), startSession(settings), topUp(amount), cashOut(), nextHand(), act(action,handId,revision), setPaused(boolean), prepareBot(), commitBot(handId,revision), importHistory(text), exportHistory():Promise<PublicHistory>. Mutation methods Promise<void>; prepareBot persists one CSPRNG draw token BEFORE sampling and persists result before timer commit. UI owns presentation/timers only; calls controller, never writes GameState/wallet. Controller atomically persists all candidate state and financial events BEFORE exposing it. Failed commits leave prior state, pause actions and expose Retry. Duplicate IDs are inert; stale revisions fail closed.

IndexedDB transactions provide compare-and-swap revision plus an expiring single-writer lease; stale tabs read-only. Guest data stays on this browser/device, no sync/auth requirement. Hashes detect accidental corruption, not adversarial client tampering. Public imports are size-limited validated study-only history, never a wallet credit or live-state restore. Private snapshots/policy metadata never appear in normal exports. Reset changes wallet baseline/epoch, retains old hand results. Initial wallet defaults to $10,000 and is editable. Topups/cashouts apply only between hands; wallet-only edits may occur anytime. Min/max buy-in in BB and topup permission frozen per session.

## Step 4A additive opponent contract

Existing engine/replay/money APIs remain unchanged. BotObservation adds optional public rake and bounded BotMemory. BotProfile retains original fields and adds optional stable personalityId, skill, environment, unknown flag and thirteen unit-interval traits. CashSettings adds optional population, opponents configuration and tableMode. Optional fields preserve all existing saved snapshots and hashes; historical and active legacy profiles are never rewritten. Original policy implementation remains version-dispatched for saved sessions. New sessions resolve and persist per-seat independent personality seeds once; copied settings reproduce identities, explicit randomized lineups choose new seeds.

New bot-module exports: createProfile(config:OpponentConfig, seed:number, environment:PopulationPreset):BotProfile; resolveConfig(config,seed):OpponentConfig (integrator may normalize); supportedPolicy(version):boolean; buildOpponentMemory(hands:PublicMemoryHand[], observingSeat:number, retention:number):BotMemory. Existing defaultProfile / policyDistribution / chooseDecision / DecisionCache remain stable. PolicyDistribution stays fold/check/call/raise; diagnostic analysis may additionally expose action-family and sizing evidence for tests, never Live Table.

Root owns contracts, session/storage integration, allowed-memory projection, release/evidence. Bot lane owns src/bots and tests/bots4a. UI lane owns src/ui (preserve seat geometry/controls). Verification owns tests/step4a and test-only browser/simulation harnesses. All use isolated worktrees. Profile sampling never reads deck entropy or other bot profiles; memory input excludes Hero private/mucked cards and privateProfiles. Session memory is a deterministic bounded projection of committed public histories, so reload neither rerolls nor invents observations. No schema migration or hand-record rehash is required. Unknown profiles remain unknown in ordinary Study view.

## Step 4B frozen concurrent interfaces

New sessions will use `synthetic-cash-1.1.0`. Source `src/bots/v1/` freezes Version5 `synthetic-cash-1.0.0`; only relative import paths change in the copy. All existing persisted profiles and pending decisions remain version-dispatched without resealing old histories. Engine, bankroll, storage schema and public observations are unchanged.

`src/bots/range-contract.ts` freezes pure advisory types. Preflop lane exports `analyzePreflop(observation:BotObservation,profile:BotProfile):PreflopAnalysis` from `preflop.ts`, plus class/combo enumeration helpers documented by that lane. Range lane exports `analyzeRanges(observation:BotObservation,profile:BotProfile):RangeAnalysis` from `ranges.ts`. Both receive ONLY the bot's allowed observation and own profile, never another actual profile. Postflop lane integrates these into `strategy.ts` while retaining existing analysis fields and adding optional `preflop?:PreflopAnalysis; ranges?:RangeAnalysis` diagnostics. Diagnostics never go to ordinary UI/export.

Ranges replay committed public events deterministically from observed priors. Actual known cards are zero-weight blockers; unseen cards are hypotheses, never truth. Recompute from the saved observation/history after reload; bounded memoization is optional and cannot change outputs. Equity sampling uses its own deterministic public-observation stream, never action entropy or authoritative deck. Full combo weights and uncertainty are for independent synthetic diagnostics only.

Ownership for this phase: root owns version facade/profiles/boundary/contracts/session/storage/UI/browser/release; preflop lane owns `preflop.ts` and `tests/preflop4b`; range lane owns `ranges.ts` and `tests/ranges4b`; postflop lane owns `strategy.ts`, `features.ts` and `tests/postflop4b`; independent verification owns `tests/step4b` and `scripts/step4b-*`. All isolated worktrees. No same-file concurrent writes. Original339 tests retained; old strategy-specific expectations may run against frozenv1 where they assert historical policy rather than new semantics, with the reason explicitly recorded. Never replace failed new tests with observed-output targets.

## Step 4C frozen concurrent interfaces

New sessions use synthetic-cash-1.2.0. Version6 source is frozen under src/bots/v2 with relative-import changes only; all 1.1/1.0/phase0 decisions remain dispatched. No engine, financial, observation or persisted schema changes. Root owns policy facade, profiles/version identity, compatibility, browser, tracker and release. Preflop lane owns preflop.ts, tests/preflop4c and its model documentation. Independent verification owns tests/step4c and scripts/step4c-*; no production policy edits. Strategic audit lane owns ranges.ts, strategy.ts, features.ts and tests/strategy4c only for independently reproduced defects. Existing BotObservation/PreflopAnalysis/RangeAnalysis interfaces unchanged; optional diagnostic additions require review. Fresh development seeds and sealed held-out seeds live in the verification harness; held-out failures become development cases and require new held-outs after fixes. No retrospective target tuning. All agents use isolated worktrees.

## Step5A release-hardening ownership

Published Version7 policy1.2 is the baseline. The engine, session ledger, storage schemas and existing bot observation interfaces remain authoritative and frozen unless a reproduced defect requires an integrator-approved additive change. Root owns version dispatch/freezing, shared contracts, production UI, actual browser control, source/release and final acceptance mapping. Runtime policy changes require freezing1.2 before integration; no historical session or hand is rewritten.

Four isolated lanes: strategy owns `src/bots/{strategy,features,ranges}.ts` and `tests/step5a-bots` (initial reconstruction before proposing runtime changes); pricing owns `tests/step5a-pricing` with an independent reference calculation and no production settlement code; requirement audit owns `R1_REQUIREMENTS.csv`, `R1_DASHBOARD.md`, `scripts/build-r1-dashboard.mjs`, `tests/r1critical` (original IDs/criteria unchanged); reliability/population owns `tests/step5a-release`, `tests/browser/step5a-*`, `scripts/step5a-*` except the dashboard script. Root alone runs browser UI tests. Every lane commits exact executed evidence and notes unsupported cases. No same-file concurrent edits, no test-target tuning, no human-review claim, no tournament/variant expansion. All agent runtime fixes are reviewed and integrated serially.

## Playable single-table tournament integration (Version34 candidate)

The user authorized tournament implementation after Version33. The first playable scope is 6/9-player home freezeouts; larger catalogue fields remain preview-only. Cash architecture and all original acceptance/deferred IDs remain unchanged. One shared poker engine owns tournament cards, legal betting, pots, antes and payouts. A tournament event controller owns event sequencing, separate virtual entry/prize accounting and persisted transactions. UI proposes actions only.

Tournament data uses a separate versioned IndexedDB database and virtual balance (initial $100,000; explicit manual adjustments, no cash transfers). This avoids rewriting cash saves or cash statistics. The R1 test wrapper's full `?run=` identity explicitly namespaces tournament data as well. Cash sessions must finish and cash out before new tournament registration in the UI. Navigating away suspends tournament bot scheduling; committed state and pending decisions remain recoverable.

Frozen single-table event configuration includes preset, entry/fee, entrant count, hands-per-level, blind schedule, rules/profile and bot-policy versions. There is no wall-clock blind advancement, rebuy, late registration, table balance or simulated fake field reduction. Background tables are not enabled. Terminal events cannot generate repeated prize credits. Existing synthetic cash opponents remain a temporary tournament foundation; no ICM or measured human-tournament calibration claim is made.

Parallel isolated ownership: engine agent owns core/contracts plus minimal dead-ante advisory pricing; controller agent owns tournament event/persistence/controller; UI agent owns tournament-play renderer/styles. Root owns existing app integration, staging identity, release records and final merge. Independent reviewer checks financial/forced-bet/recovery boundaries. Each lane commits before integration and relevant tests are rerun on the combined candidate.

## Version35 tournament review repairs

Patch17 and review repairs are documented in TOURNAMENT35_REPORT.md. New tournament genesis is $2,000; legacy $100,000 genesis and existing balances are preserved. Format2 stores immutable completed archives separately from verified active/financial checkpoints; full audit is required on recovery. A new versioned synthetic short-stack policy applies only to new events. Cash engine authority is unchanged. Post-bust fast-forward executes every normal engine action and settlement; previous snapshots offer audited private export, never silent rollback. Version34 cannot read format2. Physical devices, VoiceOver and full tournament strategic acceptance remain unverified.

## Version37 classic blackjack live integration

BlackjackController owns a separate $2,000 virtual wallet, current classic-engine shoe and transactional archive/checkpoint protocol. UI mutations use revision-checked controller commands; hints receive only blackjackView and visible-count history. Casino default is50¢ once per round, including splits. Full independent archive audit is required on load. Cash/tournament authority and schemas are untouched. R1 wrapper permits only the exact run's blackjack test database; production guest namespace is rejected. Previous backup is export-only, never silently restored. Free Bet and side-bet wagers remain unavailable. See BLACKJACK37_REPORT.md.

## Version 47 tournament context and background work

New tournament policy 2.1 receives public hand/round-start standings as a separate validated argument: players left, paid places and remaining stacks. No other players’ hole cards or future deck data enters this argument. Its decision identity includes the complete stack multiset; prior policies ignore standings and preserve their old fingerprints. This is a designed bubble heuristic, not ICM.

Other-table preparation runs cooperatively on a copy. The authoritative state, balances and finishes change only in the existing validated round commit. Cached results are scoped to event/round/other-table hand IDs; revision changes prevent stale commits. Uncommitted work is discarded on reload. The main-thread slice target is not a maximum decision latency guarantee.

## Version 48 — tournament statistics and named regulars

New events use `synthetic-tournament-2.2.0`; all earlier tournament dispatch paths and Version 47 observation fingerprints remain unchanged. The 2.2 overlay adds profile-trait adjustments to the existing public-observation/standings model; it has no access to other players' private cards or profiles. New events persist an optional `field` describing regular identities and population; validation checks names, counts and exact regular profiles. Existing events without this field retain their original roster. Regular cash opponents use the unchanged synthetic-cash-1.6.0 custom-profile contract and fixed personality seeds; recorded hand names remain authoritative for history.

`src/tournament/stats.ts` is a pure projection of saved completed/busted events, ledger timestamps and Hero-dealt hand records. Statistics never write game state, ledger, balances or saves. MTT comparison identity is global player identity, not local seat number; archived Hero hands are included. Engine blind-seat metadata is authoritative for dead-button statistics. Named/strong regular comparisons are disclosed synthetic references, not measured-human or solver benchmarks. UI cache is keyed by save revision and filter. Qualification remains separate from broader R1 acceptance.

## Version 49 — bounded human touches

Only new cash tables carrying `humanLayer: human-1.0.0` and current base policy1.6 use the mood and sizing overlay. New tournaments use `synthetic-tournament-2.3.0`; all older dispatch branches remain frozen. The saved base profile is never rewritten. Mood derives from at most eight completed public results belonging to the same cash session/personality or tournament player. MTT history selection covers enough sealed blocks for eight rounds, including table moves; archive sealing must not reset mood. Cash's120-hand hot history exceeds this window. No other player's private cards enter mood.

Sizing remains a legal proposal to the existing engine. Prepared decisions and entropy remain persisted through the existing controller protocol. Think time delays an already prepared decision and cannot change it; old sessions retain fixed pacing, and cash's post-fold fast path remains. Tournament timing is scoped to event/hand/revision/pace and resets when paused, complete or away. Pot-sensitive timing uses the engine's current pot. The Human touches label describes only the active session, not unrelated historical hands.

These are designed synthetic behaviors, not measured human calibration or a demonstrated strength improvement. Existing release gates remain unchanged. Save-only qualification is recorded in TEST_EVIDENCE/version49.

## Version50 public opponent memory and presentation

New tables opt into human-1.1.0; new events opt into tournament2.4.0. Prior versions retain their exact decision paths. Cash AppData may carry additive `humanMemory`: immutable latest400 global public-action summaries keyed by observed personality, with cumulative uninterrupted-session result counters. Initialize only when a new table starts, advance exactly once with settled canonical hands, verify against resident tail/transition and full history during full audit. Do not store hole cards, decks or replay frames in this projection. Named tournament regular carryover is perregular, witnessed Hero hands only, across the last ten completed events. A zero-stack seat is not an observer. Table talk and voluntary shown winning cards are presentation only and must not modify ledger, canonical hand history or bot observations. No release/deployment change is authorized by this feature.

Older emergency writers can preserve a stale optional humanMemory prefix. Validate that prefix against canonical hands before catching up its summaries in a verified mutable draft; if the compact tail cannot verify it, require full-history recovery. Never treat a newer or corrupt prefix as a repairable lag. Ordinary current-tip memory remains shared and does not replay400 summaries per action.

## Version51 — habits and versioned stakes cast

New cash tables use human-1.2.0 and new tournaments use synthetic-tournament-2.5.0. Prior layer and policy dispatch paths retain their original decisions and RNG consumption. Habit proposals consume only the existing public observation and own hole cards, then pass through existing legality/commit authority. Fixed named-regular habit overrides require the full authored profile to match; edited profiles derive habits from their current traits. Existing humanMemory compaction and witnessed-only carryover remain authoritative.

Field cast-2 restricts new regular populations by event tier; cast-1 continues validating the original twenty against the historical pool. Saved identities are never replaced by current stakes defaults. UI stakes groups and seating are setup proposals only. The new behaviors are authored heuristics, not human or solver validation. No release/deployment authorization changes.


## Version52 additive boundaries — churn and ICM

New cash tables use human-1.3.0. Deterministic next-hand churn uses cumulative public memory, changes only opponent seats through the existing queued-configuration boundary, and does not debit Hero's wallet. All busted opponents remaining after the one-replacement limit rebuy. Optional seatNames are one-shot, validated for occupied opponent seats, uniqueness and authored regular identity, and consumed when applied. churnNews is bounded and tied to the current hand. Old human layers retain their prior path.

New tournament events use policy2.6.0. Final-table context adds prizes, playerIds aligned with stacks, and seatPlayers mapping local seats to global event players. The selected table determines this mapping; no nearest-stack identity inference is allowed. New decision fingerprints cover prize ladder and mapping. Old policy fingerprints and decisions remain unchanged. Exact Malmuth–Harville equity is an input to a heuristic preflop risk adjustment, not exact all-in EV or postflop ICM strategy.

Version52 remains save-only, NOT READY FOR R1. See TEST_EVIDENCE/version52.


## Version53 — buy-in depth and witnessed table reads

New cash tables use human-1.4.0; new tournament events use policy2.7.0. Existing versions remain frozen. Opponent funding stays outside Hero's ledger, explicit setup stacks win over styled defaults, and churn preserves the Version52 one-replacement/top-up/name safeguards. Authored regular buy-in overrides require the complete authored profile; edited profiles derive their style from current traits.

Cash opponent reads use only the latest120 canonical hands with contiguous matching observer and target identities in the current session. This fixed window matches the compact resident tail. Tournament opponent reads use jointly witnessed latest300 Hero-table hands, matching event identities across seat moves; off-table actions are not supplied. Only public events contribute behavior. No cache may leak observations between restored copies, identities or events. New fingerprints include numeric public reads; older hash paths remain unchanged.

Version53 remains save-only, NOT READY FOR R1. Existing browser storage interruptions are not considered fixed. See TEST_EVIDENCE/version53.

## Version54 — live UTG straddle and tournament push/fold

Cash rule profiles may opt into exactly `straddle:{kind:'utg-live',multiple:2}`. This capability uses engine0.6.0, including hands where no player posts; ordinary cash retains0.4.0 and tournaments0.5.0. Authentic legacy0.3 cash remains supported. New public frames carry an additive engineVersion only for the straddle capability, preserving historical non-straddle frame bytes. Full and compact stored-hand provenance and public imports check capability markers and forced-bet evidence before accepting records. Old readers are not supported for straddle saves.

The engine alone chooses next-hand positions, posts the voluntary UTG blind with at least four funded players and chips behind it, starts action to its left, and preserves the straddler's option. Full-raise increments use the straddle preflop and return to the original big blind postflop. Hero's standing preference applies only to future eligible deals; a rule change applies through the existing between-hand configuration boundary. No cards are consulted when deciding whether to post. Button/multiple straddles, bomb pots and run-it-twice remain unavailable.

New tables use human-1.5.0; new events use tournament2.8.0. Saved older decision/hash/RNG paths remain unchanged. New push/fold calls use contestable pot pricing, include earlier limpers among possible responders, reconstruct public exposure at the shove, exclude dead antes from remaining stack depth and map final-table ICM through stable event identities. Re-shoves account for other live deep responders. These are authored range heuristics, not an equilibrium or validated human calibration. Version53 memory, edited-profile and numeric-read fingerprint safeguards remain intact.

Version54 remains save-only, NOT READY FOR R1. See TEST_EVIDENCE/version54. Earlier browser storage interruptions remain unresolved.


## Version55 — multiway play and per-player sizing

Only new cash tables use human-1.6.0 and new tournament events use policy2.9.0. Stored older versions retain their complete decision/hash/RNG paths. The new postflop overlay receives public seat/action state and the actor's own cards only. It adjusts multiway discipline, protects private strong hands and adds authored sizing tendencies; it is not an equilibrium solver or human-calibrated policy. New fingerprints retain the complete numeric table-read digest and add applied-overlay labels.

Sizing changes must remain within engine-provided raise authority and chip denomination, preserving legal capped all-ins. Named regular overrides require an unchanged complete authored profile. Multiway air classification preserves substantial straight draws; board-only strength and guaranteed shared nuts need separate handling. Version54 straddle capability/versioning, push/fold pricing and identity, historical saves, memory/churn and ledger boundaries remain unchanged.

Version55 remains save-only, NOT READY FOR R1. Prior browser storage interruptions remain unresolved. See TEST_EVIDENCE/version55.


## Version56 — witnessed showdown image and board texture

Only new cash tables use human-1.7.0 and new tournament events use policy2.10.0. Prior decision/hash/RNG branches remain frozen. Image evidence consists of public actions, board, payouts and explicitly shown showdown cards, never undisclosed opposing cards. Cash requires contiguous current observer/target identities in the latest60 canonical hands; tournaments require joint attendance in the latest60 archived Hero-table hands with stable event identity across moves. Off-table MTT simulation receives no image history. Exact-content immutable DTO caching may reuse classification; observer results must not leak across saves, identities or mutations.

New decision hashes bind numeric image evidence, retaining existing table-read fingerprints. River bluff attribution requires a river raise; a board-only monster is not a private-strength signal. New texture/image action adjustments preserve authoritative legal actions, shared absolute nuts and substantial straight draws. The engine, ledger and frozen base model stay unchanged. These are authored heuristics, not validated human strength or equilibrium play.

Version56 remains save-only, NOT READY FOR R1. Earlier storage interruptions remain unresolved. See TEST_EVIDENCE/version56.

## Version57 — heads-up aggression and preflop raising wars

New cash tables use human-1.8.0 and new tournaments policy2.11.0. Prior action/hash/RNG branches remain frozen. New preflop layers apply strictly above30BB effective depth against the current aggressor, exclude dead antes, and preserve existing all-in decisions. Heads-up aggression requires observed public initiative and authoritative legal actions. No opposing private cards are added to observations. Numeric public-image/read fingerprints and observer-limited histories remain intact. The engine, ledger and frozen base cash policy are unchanged. These authored rates do not establish measured-human realism or solver strength. Save only; NOT READY FOR R1. See TEST_EVIDENCE/version57.

## Version58 — postflop fights and river decisions

Only new cash tables use human-1.9.0 and new tournament events policy2.12.0. Prior decision/hash/RNG paths remain frozen. The new postflop layers run after existing aggression and before final sizing; cash subsequently applies multiway discipline, while tournament multiway discipline precedes these layers. They consume only the actor's cards and public observations/reads; all numeric image/read fingerprints and witnessed-history limits remain intact.

Check-raises require an observed earlier check; in-position raises, floats and take-aways require actual last-to-act position. Take-aways require continuity with the prior street's sole bettor and the actor's call. Private two pair and eight-out straight draws are distinguished from board-only strength. Floats must leave chips behind. River call pricing uses contestable capped pots, protects absolute/shared nuts, and attributes evidence to the current street's actual bettor. Low-skill recreational profiles do not receive the skilled river overlay. Engine legality, denomination and short all-in authority remain final.

The hand engine, ledger, persistence schema and frozen base cash model are unchanged. This is an authored heuristic policy, not measured-human calibration or equilibrium strategy. Save only; NOT READY FOR R1. See TEST_EVIDENCE/version58. Earlier storage interruptions and the cash recovery notice remain unresolved.

## Version59 — authored calibration and bounded rivalries

Only new cash tables use human-1.10.0 and new events tournament2.13.0. Prior decision/hash/RNG paths are frozen. Rivalry evidence is public settlement data with unambiguous single-recipient awards, stable identities and numeric fingerprints. Cash uses latest120 canonical hands for full/compact equivalence; tournament observers retain only their own losses in latest300 archived Hero-table hands. No hidden-card evidence or fabricated off-table memory is permitted. Ambiguous duplicate identities and multiwinner awards are excluded.

Profile changes are conservatively disabled where legal exposure could reach half the remaining stack. Explicit grudge actions and final sizing obey the same strict limit. Calibration distinguishes private made hands/draws, protects shared nuts and verifies actual position/check-to order. Prior grudge talk requires the real current pot relationship and content-complete presentation caching. The engine, ledger, financial schema and frozen base model are unchanged. Authored heuristics are not measured-human validation. R1 remains unqualified; see TEST_EVIDENCE/version59.

## Version60 — postflop/stage overlays and growing tournament fields

Only new cash tables use human-1.11.0 and new events tournament2.14.0. The frozen base model and old action/hash/RNG branches remain unchanged. New postflop initiative requires actual public check-to/position evidence, distinguishes private strength from board strength, protects absolute/shared nuts and uses contestable call prices. Tournament stage adjustments must not override short effective-stack play (25BB or less, excluding dead antes); full-ring middle-stage stealing requires antes. Numeric read/image/rivalry fingerprints and final rivalry exposure caps remain intact.

New multi-table events carry an optional registration structure with a four-level window. Each extra entry contributes exactly one starting stack, buy-in and fee to the synthetic field; Hero still pays one entry and receives one final prize. Initial field size remains immutable, while actual entries determine final rankings, payout ladders, exported totals and statistics. A bot may re-enter once only after its own recorded elimination, retaining its exact profile. Hero cannot re-enter. Deferred eliminations are not live players and are visible as awaiting place; places/prizes are finalized at closure. An event completing before the window closes cancels remaining reserved arrivals.

Validation enforces the registration cutoff, two-entry limit, identity/parent/profile relationships and growing financial totals. Full replay independently reconstructs deferred eliminations, tie ranking and odd-cent payouts rather than calling the runtime ranking helper. Legacy events without registration preserve the freezeout path. New registration-bearing saves require Version60 or later; no old-reader compatibility is asserted. The hand engine and Hero ledger schema are unchanged, but tournament event persistence has additive registration data. Original302/86 records and R1 qualification remain unchanged. See TEST_EVIDENCE/version60.

## Version61 — signature leaks and recreational quirks

New cash tables use human-1.12.0 and new tournaments synthetic-tournament-2.15.0. Older stored decision/hash/RNG branches remain frozen. New authored leak/quirk layers consume public observations and the actor's own cards only; no engine or ledger changes. Named leak overrides require the complete unedited authored profile, not merely a matching name/seed. Numeric read/image/rivalry fingerprints and final rivalry exposure caps remain intact. The Version60 registration, delayed ranking and independent audit boundaries remain unchanged. These are designed tendencies, not human calibration or solved play. See TEST_EVIDENCE/version61 for executed checks and remaining limits; no original302/86 or R1 gate promotion.
