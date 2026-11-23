# Synthetic cash opponents — version 1.6.0

Evidence tier: **DESIGNED / SYNTHETIC / NOT HUMAN-VALIDATED**. These are versioned engineered behaviors, not measured human populations, solved strategies, certified expert play or predictions of real earnings. Eight styles, Unknown, Custom and Random remain available. Skill is independent of stakes and population selection. Stable seeded, bounded, correlated personality traits persist with the session.

## Modules and authority

- `policy.ts`: version dispatch, allowlisted observations, one action draw and an optional size draw, action identity and one-hand cache. The session controller durably reserves the draw token and seals the proposed action before committing it once.
- `profiles.ts`: eight archetypes, thirteen traits, individual personality construction and synthetic low/mid/high/neutral population mixtures. The numerical baseline traits are retained from1.0. They are engineering assumptions.
- `preflop.ts`: explicit169-class ordinal table with6/4/12 combinations per pair/suited/offsuit class (1326 total), physical seat positions and five betting nodes. Stack sensitivity interpolates20/40/60/100/150/200/300BB. Position, size, opener, limpers, callers, squeeze opportunity, skill, population and personality affect continuation, raise and call weights. First-in initiative is separated from priced defense, with the actual remaining responders and graduated physical opening seats. See `PREFLOP_MODEL_1_2.md`.
- `ranges.ts`: uncertain weighted combo inference from public action sequences and sample-shrunk public observations. No actual opponent profile or hidden cards enter it. Current own/community blockers remove impossible combos. Joint compatible-range samples estimate showdown share including ties, with separate Monte Carlo error and model uncertainty. See `../../docs/models/RANGES_1_1.md`.
- `features.ts` and `strategy.ts`: made hands/private contribution, clean/dirty draws, public board development, weighted-range equity, position, realization, future costs, implied/reverse-implied risk, pot odds/rake and public lines. Value, thin value, protection, cbet/delayed cbet, barrel, selected bluff/semibluff, check-raise and trap families overlap. All sizing is bounded by engine legality. See `../../tests/postflop4b/MODEL.md`.
- `pricing.ts`: read-only capped-call pricing excludes unmatched excess and higher side pots the acting stack cannot win. The actual outstanding wager, rather than the capped call, supplies sizing context. Rake remains an advisory estimate; the engine is authoritative.
- `memory.ts` and `boundary.ts`: bounded public-action and revealed-showdown projection, field allowlist and validation. Live/Study controls never receive the private distributions, diagnostic ranges or Unknown identities.

The poker engine alone moves chips, deals cards and settles pots. Advisory equity is not a money ledger, payout or full decision EV. Side-pot-specific strategic equity, solved multi-street search and empirical likelihood fitting remain limitations; settlement itself remains authoritative and independently tested.

## Original premium-hand defect

The exact frozen1.0 first-in UTG audit reproduced the reported AA frequencies. Classification and fixture were correct. General aggression dominated conditional raising even when the value hand was strongest; the old AA continuation guard prevented folds but allowed routine passive limps. Version1.1 uses a continuous premium-value mechanism across hand classes and bounded deliberate trap probability. No AA-only raise-frequency override or empirical claim was added. Pre-registered synthetic release bounds and exact old samples are in `tests/step4b`.

## Version and privacy contract

New sessions use `synthetic-cash-1.6.0`. Saved1.5 sessions dispatch to `v6/`, frozen byte-for-byte except relative imports before the remaining-exposure correction. Saved1.4,1.3 and1.2 sessions dispatch to `v5/`, `v4/` and `v3/` respectively. Saved1.1 sessions dispatch to `v2/`, frozen from published Version 6 byte-for-byte except relative imports. Saved1.0 sessions dispatch to `v1/`, frozen byte-for-byte except relative imports; its original model card is retained there. Phase0 sessions retain `legacy-v0.ts`. Do not rewrite active profiles, pending decisions or historical metadata when releasing a policy.

Action entropy is independent of deterministic advisory sampling. Fingerprints include the complete allowed observation and own policy. Rerenders, failed writes and reloads must not reroll a committed decision. Tests compare frozen decisions, sampling consumption and hashes; interrupted old-policy saves settle once before starting new-policy sessions.

Public memory uses at most120 completed canonical hands in the same session. VPIP/PFR memory rates use hands with an actual preflop decision, not reconstructed canonical legal-raise opportunity denominators. Aggression uses postflop decisions; fold-to-bet uses positive-price postflop decisions. Sparse observations shrink toward synthetic priors. Exact public player statistics and independent simulation opportunities retain their separately defined denominators.

## Limits and evidence

Range advantage, nut advantage, implied odds, realization, fold equity and mistake parameters remain approximations. Showdown-share standard error covers finite sampling only. It does not express confidence in human realism. Bounded adaptation can be exploited, and intended recreational weaknesses remain. Low/mid/high presets are hypothetical contexts, not measured rooms or stake-to-skill rules.

The historical research reviewed in `TEST_EVIDENCE/step4b/QUALITATIVE_SOURCES.md` is not an eligible action-frequency calibration dataset. There is no licensed human holdout, blind human comparison or independent solver certification. Simulation results must retain the policy version, seed, opportunities and uncertainty. Full release evidence is recorded separately after tests execute; this model card alone does not pass a gate.

## Step4C evidence boundary

The TAG range audit corrected the old entry-versus-RFI description, separated opening initiative from call-defense penalties, and removed the total-table-size penalty when the same players remain behind. The authored initiative credit is a synthetic strategic hypothesis, not a fit to human frequencies or a claim of solver equivalence. Folded-card bunching inference is not modeled. Capped-call pricing and inaccessible-pot exclusion are arithmetic fixes; tranche-specific strategic equity and multi-street EV remain approximate. Independent held-out experiments and complete-hand examples are recorded under `tests/step4c` and `TEST_EVIDENCE/step4c`. No external expert has reviewed this release and no rights-verified, context-matched human holdout has been evaluated.


## Version1.6 remaining-exposure correction

The1.5 near-all-in heuristic treated one remaining cent as an open future-street decision, then abruptly granted complete draw realization at zero remaining chips. An independently reconstructed three-way flop found stronger-regular defense4.62% at a2999 call versus32.29% at3000, despite identical sampled showdown equity. The cheaper state could legally raise all-in for one additional cent. This was a numerical/strategic approximation boundary defect, not a pot-eligibility error or evidence about human frequencies.

Version1.6 computes remaining effective exposure from public chips after the hypothetical call: the lesser of the actor’s remaining stack and the largest live opponent’s remaining stack after funding any outstanding amount needed to match that call. Opponents are not assumed to actually call. Let `e` be that effective exposure and `P` the currently contestable pot after calling; the interpolation weight is `q = e / (e + max(1, P))`. On the river `e=0`. The existing open-street realization and second-card realization become `1 - (1 - baseline) * q`; existing future cost, implied upside and reverse-implied downside are multiplied by `q`. Thus a disappearing residual stack continuously approaches the prior exact all-in behavior, while deep exposure approaches the existing open-street approximation. Public posterior ranges, actual prices, chip movements and legal-action authority are unchanged. No forced continuation quota or globally monotonic clamp is applied.

These remain synthetic approximations. They do not solve multi-street decisions, forecast a player behind’s actual action, estimate tranche-specific strategic equity, or claim human/solver calibration. Ranges can genuinely change with price, and strategically different situations need not have globally monotonic frequencies. The two extra private diagnostics are remaining effective exposure and its interpolation weight; they are not exposed by Live Table controls.

Executed evidence: `tests/step5b-exposure/` includes the exact discovery,168 held-out boundary triples/8,064 proposals,84 exact comparisons of all-in/river distributions against frozen1.5, and94 focused bot regression tests. The held-out maximum one-cent defense change was0.001114. Forty paired cold-analysis samples per2/6/10players×flop/turn/river measured candidate p95 up to28.27ms on the shared Node host, with concurrent resource stress; this is not physical-phone or browser-INP evidence. Versioned draw surfaces for1.6 were actually regenerated. Historical policy1.5 source bytes and dispatched decisions remain independently checked.

## The Regulars (patch 30)
- Twenty named computer players (`src/bots/regulars.ts`). Each is an ordinary custom profile under `synthetic-cash-1.6.0`: a base archetype, chosen trait values and a fixed personality seed, so the same regular plays the same way in every cash game and tournament.
- Designed characters, not models of real people and not measured player types. Each carries a one-line read (how they play and how to beat them), shown when they are seated.
- Cash games: choose a regular per seat from the style menu, or "Seat the regulars" to fill the table. A regular's name and style are visible at the table by design. Editing any trait makes the seat an ordinary custom opponent.
- Tournaments: new events seat about four in ten regulars (at most all twenty). The rest of the field is drawn from the tier's population mix (home → low, casino → mid, series → high). The field is saved on the event and checked on load.

## Tournament policy 2.2.0 (patch 30)
- 2.2.0 = 2.1.0 plus personal quirks. How far a player's traits sit from their archetype's stock values shifts their tournament play:
  - risk tolerance shifts push depth, all-in calling width, bubble caution and bubble bullying;
  - bluff frequency shifts first-in width and continuation bets;
  - position awareness shifts late-position steals;
  - draw calling shifts all-in calling width.
- A profile whose traits equal its stock values plays exactly like 2.1.0 (tested). 2.1.0, 2.0.0 and 1.0.0 events replay unchanged.
- Designed shifts, not fitted to human data.

## Human touches: human-1.0.0 (cash) and tournament policy 2.3.0 (patch 31)
- **Mood.** A player's own last 8 finished hands (public end-of-hand facts) set a tilt level and a confidence level. Big losses at showdown, measured in big blinds or as a share of the stack, tilt; big wins add confidence; both fade over a few hands.
  - How easily someone tilts follows skill, mistake rate and risk tolerance. Strong regulars barely tilt.
  - Tilt makes a player looser, more aggressive, more bluff- and error-prone. It works by shifting the player's profile values before the unchanged base model decides.
- **Human bet amounts.** Raises are rounded to amounts people say (2,350 → 2,400; $37.40 → $35). Weaker players round more coarsely. Anything close to all-in becomes all-in.
  - Players with skill under 0.55 give size tells: bigger with strong hands (and premium pairs before the flop), smaller with draws and weak hands. Strong players stay balanced.
- **Think time** (screen only, the decision is already saved): snap folds, quick checks, longer for big bets, river decisions and all-ins, occasional tanks. Each personality has its own tempo; tilted players act faster.
- **Where it applies.** Cash: tables started since patch 31 (`humanLayer:'human-1.0.0'`) and current-policy profiles only. Older tables and older-policy profiles keep their exact decisions. Tournaments: new events (policy 2.3.0); older events replay unchanged.
- Designed behaviour for practice realism, not fitted to human data.

## Reads, session moods and table talk: human-1.1.0 (cash) and tournament policy 2.4.0 (patch 32)
- **Reads on Hero** (`src/bots/reads.ts`) come from Hero's public actions in saved hands. They measure:
  - folding blinds to steals;
  - folding to continuation bets;
  - folding to 3-bets;
  - calling all-ins;
  - short-stack shoves;
  - postflop aggression;
  - showdown frequency.

  Each rate is shrunk toward a typical value until there are enough chances.
- **Who exploits the reads:** adaptive, skilled players (adaptation × skill). They steal more from a Hero who gives up blinds, 3-bet more against a Hero who folds to 3-bets, shove wider into a Hero who rarely calls, call Hero's wide shoves lighter, bluff more into a folder and less into a caller, and call down an aggressive Hero. Recreational players barely adjust.
- **What a bot remembers:**
  - Cash: a personality remembers hands it observed within the latest400 global table hands (identities persist between sessions). Public summaries survive archive compaction; current-session result counters continue beyond this window.
  - Tournaments: players remember Hero's hands in this event that they sat in. Named regulars also carry only their own witnessed reads from Hero's last ten completed events, saved on the event as `heroReads` and checked on load.
- **Session moods** (cash):
  - stuck players chase losses (tilt-prone ones most);
  - winning strong players lock up, while winning weak players splash around;
  - long sessions make weaker players sloppy.
- **Stack moods** (tournaments): weak short stacks either panic (risk-takers) or freeze and blind away (cautious players). Big stacks loosen up.
- **Table talk and shown hands** (`src/bots/talk.ts`) are screen only. They are deterministic per hand, with at most two short lines per hand, in character for regulars and archetypes. Loose players sometimes show bluffs and weaker players show strong hands after winning uncontested. Players say GG when they bust. A "Table talk" switch turns it off.
- Designed behaviour, not fitted to human data.

## Live-player habits and the stakes cast: human-1.2.0 (cash), tournament policy 2.5.0, field cast-2 (patch 33)
- **Habits** (`src/bots/habits.ts`) are applied after the model's decision, from public information and the player's own cards. Recreational players:
  - open-limp middling hands and limp-call small raises;
  - min-raise;
  - lead into the preflop raiser out of position with a piece ("donk");
  - overbet the river with monsters, a size tell.

  Trappers check strong hands and then check-raise. Good regulars float flop continuation bets in position and fire delayed turn bets. Tendencies come from traits (skill, aggression, looseness, slow play, mistakes); a regular can override them. At most one habit applies per decision, plus the min-raise habit after sizing.
- **Cast:** forty regulars, each tagged with the stakes they play (low / mid / high). Cash "Seat the regulars" fills the table from the table's stakes first (big blind up to $2 low, up to $10 mid, above that high). The style menu groups regulars by stakes.
- **Tournament field cast-2:** draws regulars from the tier's stakes (home → low, casino → mid, series → high). The count is about four in ten opponents, capped by that pool. Saved cast-1 fields (the original twenty) still validate.
- **Compatibility:** older layers, policies and fields replay unchanged.
- Designed behaviour, not fitted to human data.

Version51 integration boundaries: fixed regular habit overrides apply only to unchanged authored profiles; edited profiles use their own traits. Limp-calls require an actual limp before one raise. Flop floats exclude check-raises and require the preflop raiser’s opening bet. Delayed turn play includes a genuine float followed by that raiser checking. These conditions have independent regression fixtures; upstream frequency estimates are not reproduced calibration evidence.


## Table churn and final-table ICM: human-1.3.0 (cash) and tournament policy 2.6.0 (patch 34)
- **Cash table churn** (`src/session/churn.ts`) runs between hands on new tables:
  - busted players rebuy (losers who tilt and weaker players most often) or leave;
  - short stacks under 40% of the buy-in may top up when the table permits top-ups (strong players usually do, weak players rarely);
  - after 15 hands players may leave: winners who are strong players hit and run, calm losers quit, tilt-prone losers chase;
  - an empty chair is filled by a regular who plays these stakes or by a stranger, with a fresh buy-in.

  At most one player leaves per hand. Hero is never touched. Changes go through the ordinary queued next-hand configuration, so stacks, names and history use the existing checked path. A one-line "Table news" note shows for the hand. The plan is deterministic per hand.
- **Final-table ICM** (`src/tournament/icm.ts`): with ten or fewer players left, policy 2.6.0 computes exact Malmuth–Harville prize equity, then uses a symmetric chip-transfer bubble factor as a heuristic preflop risk adjustment, scaled by the player's bubble awareness. This is not exact call EV: unequal commitments, side pots, fold equity and postflop ICM strategy are not solved. Explicit global player IDs map the actor and opponent to original hand-start stacks, including posted blinds/antes; the prize ladder and mapping are included in new-policy decision fingerprints. Earlier in the event the 2.5.0 bubble heuristic still applies. ICM is a standard approximation, not a solver.
- **Compatibility:** older layers and policies replay unchanged. Their standings never carry prizes.
- Designed behaviour, not fitted to human data.


## Buy-in styles, stack depth and players reading each other: human-1.4.0 (cash) and tournament policy 2.7.0 (patch 35)
- **Buy-in styles** (`src/bots/depth.ts`): each personality has a buy-in habit: short-stacker (about 40 big blinds), standard (the table's buy-in) or deep (twice the buy-in, at least 200 big blinds). The amount stays inside the table limits. Weaker tight players lean short; strong and loose-aggressive players lean deep. Eight regulars name their habit (for example Gus, Hank and Mikey are short; Priya, Viktor and Monty are deep). New cash tables seat opponents with their own amounts, and a stack typed for a seat in setup is kept. Rebuys, top-ups and newcomers use the same habit. A short-stacker who has doubled up sometimes leaves with the profit.
- **Stack depth:** short (45 big blinds or less effective): fewer speculative calls, raise-or-fold, commit lighter. Short-stackers tend to shove good hands and fold weak ones instead of calling a raise; middling calls remain possible. Deep (150 or more): more implied-odds calls, less willing to stack off with one pair. Set-mining small pairs and suited connectors starts at 80 big blinds and grows with depth.
- **Players read each other** (`src/bots/table-reads.ts`): everyone keeps public reads on everyone at the table, Hero included. The reads cover how often each player plays a pot, raises, open-limps, bets after the flop and goes to showdown. After about a dozen hands the obvious types are labelled: maniac, nit, calling station, loose limper. In each spot the player adjusts to the opponent that matters (the raiser, the blind behind, or the heads-up opponent):
  - isolate weak limpers;
  - steal from tight blinds;
  - fight a maniac's open with good hands and call a maniac down;
  - believe a nit and fold non-premiums to a nit's open;
  - stop bluffing a station.

  Strong adaptive players act on reads fully; everyone notices an obvious type a little. Cash reads use at most the latest 120 canonical hands from this session while both observer and target retain their seat identities. Tournament reads use at most the latest 300 Hero-table hands jointly witnessed by observer and target, following event identities across local seat moves. This feature does not invent observations of off-table hands or cross-event opponent reads. Existing carried Hero-read memory has its own separate window.
- **Compatibility:** older layers and policies replay unchanged.
- Designed behaviour, not fitted to human data.

Version53 integration boundaries: fixed regular buy-in overrides require an unchanged authored profile. Typed seat stacks and Hero funding remain authoritative; styled amounts round inside legal limits. Effective depth facing a raise uses the live bettor, not an unrelated deep seat, and excludes earlier-street pot contributions. Open-limp opportunities exclude overlimps, raised pots and big-blind checks; forced all-ins without a decision do not add VPIP/PFR opportunities. Numeric public reads, not just labels, enter new-policy fingerprints. Older saved layers retain their existing decisions. No upstream frequency claims were independently reproduced.


## Short-stack push/fold: tournament policy 2.8.0 (patch 36)
- **Spots:** first in (or over limpers) with 15 big blinds or less effective; facing an all-in of 25 big blinds or less; facing one open from the cutoff, button or small blind with 8–25 big blinds.
- **Ranges** (`src/tournament/push-fold.ts`) are authored range heuristics with antes, not verified published charts or a solved equilibrium:
  - Open shoves narrow with depth and with players left to act. At 10 big blinds that is about 17% under the gun and about 56% on the button.
  - Calls follow the shover's likely range and the price, and tighten with players still to act behind.
  - Re-shoves over a late open use a share of a typical opening range for that position.
- **Who follows the chart:** skilled players nearly always. Weaker players less often; the rest of the time they keep their earlier behaviour (limping short, calling too wide or too tight). Risk-takers widen the ranges and cautious players tighten them. Prize pressure (bubble or final-table ICM) narrows everyone.
- **Compatibility:** 2.7.0 and older replay unchanged.

## Live straddle: engine rule (V410) and human-1.5.0 (patch 36)
- **Engine** (`src/core/engine.ts`): a cash rule profile may allow a live straddle (`straddle: {kind:'utg-live', multiple:2}`).
  - **Who and when:** each hand the player under the gun may post twice the big blind. This needs four or more players and chips behind the straddle.
  - **How it plays:** the straddle is the current bet, and the minimum raise is one more straddle. Action starts to the straddler's left, and the straddler acts last before the flop with the option to check or raise.
  - **Records:** the straddle is a `blind` event with detail "Live straddle", and the view carries `straddleSeat`. Public replay validation rebuilds straddled hands exactly.
  - **Versioning:** straddle-enabled profiles use cash engine0.6.0; ordinary cash remains0.4.0 and tournament0.5.0. The setting is part of the rule-profile configuration version, so turning it on or off applies from the next hand (V706).
  - **Still blocked:** button/Mississippi and multiple straddles (FUT010/FUT011), and bomb pots and run-it-twice (X15/V615). Tournaments reject straddles.
- **Players** (`src/bots/straddle.ts`):
  - Loose-aggressive and recreational players straddle. Tilted and running-hot players straddle more. Strong tight players and anyone under 30 big blinds rarely or never do. Upstream small-sample frequencies are not independently calibrated; Vince, Tex, Monty and Action Pete straddle often, Hiro and Mei never.
  - In a straddled pot, players read the straddle as the big blind before the flop, and recreational players loosen up a little.
  - Hero can choose to straddle under the gun.
- Designed behaviour, not fitted to human data.

## Multiway pots and bet-size tells: human-1.6.0 (cash) and tournament policy 2.9.0 (patch 37)
- **Multiway pots** (`src/bots/multiway.ts`): with two or more opponents after the flop, disciplined players change their play. They:
  - reduce the profile bluff-frequency parameter with each extra opponent (this is not a measured action-frequency reduction);
  - value-bet only stronger hands and bluff-catch less;
  - slow-play less;
  - check air instead of betting it;
  - bet strong hands for protection;
  - fold bare bluff-catchers when another player is still to act behind them.

  Discipline grows with skill; loose recreational players barely adjust.
- **Bet-size tells** (`src/bots/sizing-tells.ts`): each personality has a sizing habit:
  - **big means strong:** small bets with medium hands and bluffs, about pot with strong hands;
  - **small means strong:** trappers bet about a third of the pot with their best hands and big with bluffs;
  - **blocker bets:** a quarter-pot river lead with a medium hand;
  - **polarized:** bigger bets with strong hands or bluffs, smaller with medium hands;
  - **balanced:** no additional sizing tell from this layer; this does not prove that the underlying strategy is unreadable.

  The habit shows more plainly the weaker the player. Eighteen regulars have a named habit (Big Earl big-means-strong, Tess small-means-strong, Dot blocker bets, Marco polarized, Hiro balanced …), shown with their read in table setup. In the new layer this replaces the generic size tell from patch 31.
- **Compatibility:** older layers and policies replay unchanged.
- Designed behaviour, not fitted to human data.

Version55 integration: normal sizing respects the table chip denomination; capped legal all-ins remain legal. Protection includes genuine private two-pair hands, while shared-board hands are not promoted as private strength. Open-ended and double-gutshot draws are not classified as air, and the marginal-fold overlay preserves a guaranteed shared-nut chop. Named sizing overrides require the complete unchanged authored regular profile. Version54 engine, push/fold, public-read and historical decision paths remain intact. Upstream betting-frequency claims were not independently reproduced.


## Table image and scare cards: human-1.7.0 (cash) and tournament policy 2.10.0 (patch 38)
- **Table image** (`src/bots/image.ts`): players remember what was shown down, using only cards actually revealed at showdown.
  - A river bettor who loses with air is "caught bluffing"; that image fades over about 30 hands.
  - A player who bet and showed a monster (strength 0.85+) earns respect; that image fades over about 15 hands.
  - Facing that player's bet, others call a caught bluffer lighter and give up medium hands against someone who just showed a monster. Everyone notices; skilled players act on it more.
  - Skilled players caught bluffing themselves bluff less and value-bet thinner while their image is loose.
  - Cash images use this session while the same player holds the seat; tournament images use Hero's table.
- **Scare cards and texture** (`src/bots/texture.ts`):
  - **Scare cards:** a turn or river card that brings a third card of a suit, makes a straight possible, or is a big overcard.
  - **The flop bettor with air:** keeps firing on a scare card and gives up more on a blank.
  - **Medium hands:** slow down on a flush or straight card.
  - **One-pair hands facing a bet:** fold more on a flush or straight card.
  - **On the flop:** good players continuation-bet small on dry boards and check air on wet ones.
  - **Who reacts:** skilled players react fully; recreational players barely notice.
- **Compatibility:** older layers and policies replay unchanged.
- Designed behaviour, not fitted to human data.

Version56 integration qualification: image windows are bounded to60 canonical/archived Hero-table hands and require the acting observer to have witnessed each contributing showdown. Cash also requires uninterrupted current identities. MTT off-table simulation has no image context. Decay30/15 denotes exponential e-folding, not hard expiry. River bluff labels require river aggression; board-only monsters do not earn reputation. Fixed regression tests protect shared nuts, eight-out straight draws, hidden cards, restored-copy cache isolation and complete numeric fingerprints. Frequencies remain authored examples, not independently validated human or solver measurements.


## Preflop raising wars and heads-up aggression: human-1.8.0 (cash) and tournament policy 2.11.0 (patch 39)
- **Raising wars** (`src/bots/three-bet.ts`), deeper than 30 big blinds:
  - Good regulars 3-bet light from late position and the blinds with suited wheel aces, suited connectors and suited broadways. They squeeze over an open and a call, sizing 3× in position, 4× out of position, plus one open per caller.
  - Facing a 3-bet, regulars defend their opens with strong hands, pairs and suited broadways (more in position), and sometimes 4-bet bluff with an ace blocker (2.3× in position, 2.6× out of position).
  - Recreational players 3-bet only the very top and flat the rest.
  - Who fights preflop: skill × aggression.
- **Heads-up aggression** (`src/bots/aggression.ts`): the frozen base model is passive heads-up. When it checks in a recognised spot (flop continuation bet, turn barrel, delayed continuation bet, turn probe, river barrel, river stab), the player bets instead.
  - The chance depends on the hand (value, medium, draw, air) and the personality's aggression and skill.
  - Skilled players bet less air on wet flops.
  - Multiway pots and scare-card plays are left to their own modules.
- **Compatibility:** older layers and policies replay unchanged.
- Designed frequencies, not fitted to human data.

Version57 integration boundaries: deep raising uses current-aggressor effective stack strictly above30BB, excluding dead antes; shovers and actor-covering calls retain the existing all-in policy. Position uses actual seat order. Barrels require the last raiser on the previous street. Private two pair and substantial straight draws are classified separately from air. Captured Version56 action/hash/RNG compatibility is tested. No independently measured strength or human-population claim is made.


## Postflop fights and river decisions: human-1.9.0 (cash) and tournament policy 2.12.0 (patch 40)
- **Fights** (`src/bots/fights.ts`): facing a single bet after the flop, players can fight back:
  - check-raise strong hands (about 3×);
  - check-raise draws heads-up on the flop or turn, and occasionally check-raise a bluff on a dry flop;
  - raise strong hands and flop draws in position (about 2.8×);
  - float a flop bet in position with overcards or a backdoor draw, then bet the turn or river when the bettor checks to them (take-away).

  Fightiness = aggression × skill. Passive recreational players barely fight. In multiway pots, only value raises are made.
- **River** (`src/bots/river.ts`):
  - **Thin value:** skilled players bet a medium hand about a third of the pot when checked to heads-up.
  - **Hero calls:** they call bluff-catchers against bettors the reads mark as aggressive, more readily at a good price.
  - **Big folds:** they fold good-but-not-great hands to a river raise, or to a big bet from a passive player, and let bluff-catchers go against passive bettors.
  - **Recreational players** do none of this.
  - The bettor's aggression comes from the public table reads of patch 35 and is shrunk to a typical value without data.
- **Compatibility:** older layers and policies replay unchanged.
- Designed frequencies, not fitted to human data.

### Version58 integration corrections to Patch40

The new fights/river layers require real positional and public-bettor continuity. Private two pair and eight-out straight draws are recognized; board-only strength is not treated as a private bluff-catcher. Floats cannot consume the actor's final chip. River prices use contestable capped pots, absolute/shared nuts cannot be folded by this layer, and the skilled river layer is disabled for authored recreational skill <=0.3. All actions remain constrained by authoritative legal totals and denomination, including capped all-ins. Historical layers are unchanged and have captured prior-version golden fixtures. The author's conditional frequency measurements are not re-certified by these boundary/integration tests; there is no new strength, human realism or solver claim.


## Authored postflop corrections and rivalries: human-1.10.0 / tournament2.13.0 (Patch41)

The patch author reported a roughly2,700-hand bot-only simulation with excessive check-downs and station folds. Its quoted typical live-player ranges are unsourced, and neither those ranges nor the original before/after rates were independently recertified after integration. This is an authored heuristic overlay, not human calibration or a solver-strength claim. The frozen base model remains unchanged.

- Strong private made hands receive additional value-betting opportunities. Actual last-to-act players may stab after all remaining responders check. Non-stations may release air on later streets; stations may call private pairs or substantial draws only below half their remaining stack. Board-only strength is not private value, and shared absolute nuts are protected.
- A public single-recipient result with a loss of at least30BB may form a rivalry. Ambiguous multiple-winner/side-pot results are excluded. Levels decay with a300-hand half-life, but cash history is bounded to the latest120 canonical hands for compact-save equivalence; a loss drops out when outside that window. Named identities and Hero can carry that bounded evidence across sessions. Duplicate identities at one table are excluded.
- Tournament rivalry memory uses the latest300 archived Hero-table hands in the event, stable names across moves, and only the acting player's own losses. Off-table players receive no fabricated history.
- Grudge actions can defend/call/raise more, with stronger players affected less. Profile changes are conservatively allowed only where legal exposure cannot reach half the remaining stack; explicit changes and final sizing have the same strict limit. This is narrower than the submitted proposal.
- Grudge talk requires a prior rivalry and the current public pot relationship with Hero; the first big loss and unrelated side-pot awards cannot trigger a repeated-loss claim. Presentation caches include exact numeric levels, profiles and game content.
- New decision hashes bind numeric rivalry evidence and stable current identities. Existing cash/tournament policies retain their exact historical decisions, hashes and RNG behavior. No engine, financial ledger or save schema change.

See TEST_EVIDENCE/version59 for executed boundary, compatibility, replay and browser checks. None promote R1 or certify subjective realism.

## Version60 — human-1.11.0 / tournament2.14.0 (Patch42)

The new authored showdown overlay adds value bets and checked-to stabs, with aggression/slow-play personality scaling and reduced multiway frequency. A rough price-discipline heuristic can fold weak hands; calling stations are excepted. Actual last-to-act evidence is required for stabs, private made hands are distinguished from a strong board, absolute/shared nuts cannot be folded, and prices use the pot the actor can actually win. This supplements rather than retunes the frozen base model.

Tournament stage heuristics add early deep-stack recreational limping and skilled set-mining, middle-stage late-position steals with antes, and wider short-handed opens. An effective-depth guard at25BB (excluding dead antes) preserves existing short-stack decisions even when table-average depth is high. ICM/push-fold and historical policies remain in place. These changes apply only to new games; captured Version59 golden fixtures protect prior1.10/2.13 decisions, hashes and RNG.

The submitted tracker comparisons, showdown rates and conditional stage frequencies are author measurements, not independently recertified after integration. No claim of measured-human realism, solved strategy or stronger play follows from boundary/replay tests. Patch43 additionally adds late arrivals/re-entry to the synthetic field; this changes population and prize counts, not the Hero wallet's one-entry rule. Review evidence and remaining limitations are in TEST_EVIDENCE/version60.


## Version61 — human-1.12.0 / tournament2.15.0 (Patch44)

New tables/events receive authored signature leaks and recreational quirks. Named regulars have specified leak assignments; other profiles receive deterministic type/personality assignments. Intended tendencies include pair attachment, river payoffs, scared-money folds, draw chasing, frequent continuation bets, slow-playing, river bluffing and giving up after a flop bet. Weaker profiles express tendencies more frequently. These are probabilistic authored rules, so names such as “never folds” do not promise unconditional behavior.

Recreational quirks include premium limp traps, limp-reraises, overlimps, loose big-blind defenses, flop leads and river blocker bets. Older saved policies retain their branches. The hand engine and financial ledger are unchanged.

The submitted showdown rates and tracker comparisons are the patch author's measurements, not independently recertified after integration. They do not establish realism against measured humans or solver strength. See TEST_EVIDENCE/version61 for actual executed checks, corrections and limits.

Version61 integration narrows river-bluffer spots to a real missed draw with checked-to position, excludes board-only strength from slowplay/blocker classification and protects shared nuts. Recreational limp-reraises require public history, eligible weak profiles and sufficient effective depth. Edited regular profiles use generic type/personality assignments rather than named overrides. Earlier rivalry exposure caps remain final. The submitted audit percentages were not rerun after these corrections.

## Patch 45 (ported to Version 61): leak reads, exploits and lasting steam (cash human-1.13.0, tournament 2.16.0)
- **Leak reads** (`src/bots/insight.ts`): each player notices other players' signature leaks from hands they both played (actions and cards shown at showdown by players who did not fold). A pattern is noticed after two clear examples, or a high rate over enough chances.
  - **Witnessed only (Version 61 rule):** cash uses the latest 150 canonical hands of the current session while observer and target held their seats unchanged; tournaments use the latest 150 Hero-table hands both names played.
  - **No length or hand-ID caches:** stored hands are converted once per immutable object.
  - **Hero:** Hero's play is read the same way.
- **Exploits** (`src/bots/exploit.ts`), only for skilled, adaptive players, against the key opponent:
  - thin value bets and no bluffs against callers;
  - big bluffs against scared money;
  - check-raises and floats against auto c-bets;
  - river calls against river bluffers;
  - respect for slow-players' raises;
  - turn stabs against one-and-done.
- **Steam:** a bad beat or a cooler (25+ big blinds lost at showdown) tilts the player.
  - **How long:** a half-life of about 8 to 30 hands, longer for tilt-prone players; a big win halves it.
  - **Effect:** more preflop raises, lighter calls, more bets when checked to.
  - **Talk:** the loser comments right after the hand.
- **Decision hashes:** they record what the observer knows (`insightDigest`) and the exploit and steam plays.
- **Compatibility:** older layers and policies replay unchanged. Designed, not fitted.

## Patch 46: Hero re-entry and table dynamics (cash human-1.14.0, tournament 2.17.0)
- **Hero re-entry (T09):** in a multi-table event, if you are knocked out while late registration is open, you can re-enter once (two entries in all, like the computer players).
  - The re-entry is charged like the first entry, as a second ledger row, and you sit down with a fresh stack when the round settles.
  - Your knocked-out entry becomes its own record ("You (1)") and is placed at the close with the other early knockouts.
  - The prize pool, round audit, save validation and records (cost = both entries) all include it.
  - Add-ons (FUT082) and final-table deals (FUT078) stay deferred.
- **Table dynamics** (`src/bots/dynamics.ts`), from the public table reads, after 15+ hands:
  - **Opener on the right:** good players 3-bet lighter and flat more speculative hands when the habitual opener (raises about a quarter of hands or more) sits directly on their right. They will have position for the whole hand, so they also float that player's c-bets after the flop.
  - **Aggressor on the left:** with an aggressive opener directly on their left, they open fewer marginal hands first in.
  - **Scale:** the adjustment follows skill and how long the reads have run.
- **Compatibility:** older layers and policies replay unchanged. Designed, not fitted.

## Patch 47: live-game routines and the showdown check (cash human-1.15.0, tournament 2.18.0)
- **Showdown check:** I ran 8 tables × 300 hands on each of layers 1.12.0, 1.13.0 and 1.14.0.
  - **Stations:** went to showdown 51%, 54% and 50%.
  - **Passive regulars:** 46%, 52% and 47%.
  - **Cause:** the rise seen after patch 45 was not caused by patches 45–46 (1.12.0 was already at 51%); patch 44's 46% was the low outlier.
  - **What drives it:** nearly half of all showdowns are checked down, and about a quarter see no postflop bet at all.
- **Retune** (`stabPlay` in `showdown.ts`):
  - **Stabs:** players with some aggression bet turns and rivers that are checked to them (fewer free cards).
  - **Tight players:** they give up weak bluff-catchers to turn and river bets more often.
  - **Result** (8 × 300): nits 38–42% went to showdown (40–44% before), tag 28–36%, lag 31–33%. Stations (53%) and passive regulars (45–52%) hardly moved. Their showdowns mostly come from multiway pots that nobody bets, and stations call any stab.
  - **Next lever, if wanted:** more betting by everyone in passive multiway pots.
- **Breaks** (`src/bots/routines.ts`): now and then a player steps away for 5 to 18 hands.
  - **How often:** about 1 hand in 110 for the weakest players and 1 in 400 for the best, never in a player's first 10 hands. Breaks are deterministic per session, occupant and hand count.
  - **While away:** they stay seated, check when they can and otherwise fold quickly. They still post their blinds, a simple stand-in for live missed-blind rules.
  - **On screen:** the seat shows "On break", and table news says when they go and come back.
- **Last orbit:** a player who decides to leave (not after busting) announces it ("Last orbit for me."), plays about one more orbit a little looser, then racks up. This is cash only; tournaments get the retune but no routines.
- **Compatibility:** older layers and policies replay unchanged. Designed, not fitted.

## Patch 48: passive pots, bubble and final table, session moods (cash human-1.16.0, tournament 2.19.0)
- **Betting in passive pots** (`src/bots/passive-pots.ts`): when three or more players check to the last player on any street after the flop, that player stabs about half the pot with any pair or draw, more often for aggressive players.
- **Showdown result** (8 tables × 300 hands, against 1.15.0):
  - stations 49% (53%);
  - passive regulars 44% (52%);
  - nits 31% (38%);
  - TAG 39%, LAG 32%.
- **Bubble and final-table roles** (`src/tournament/bubble-play.ts`, tournaments only): on the money bubble and at a final table, stack size decides the role.
  - **Big stacks** (1.6× average or more) open wider when folded to, 3-bet medium stacks they cover, and bet when checked to.
  - **Medium stacks** fold marginal hands to raises and bets from players who cover them.
  - **Short stacks** (under 12 big blinds) fold marginal shoves while someone else is shorter, to ladder up. This also applies on top of push/fold.
  - **Scale:** everything is scaled by bubble awareness, so calling stations and maniacs hardly change.
  - **Talk:** the table talks on the bubble ("Hand for hand."), when it bursts ("We're in the money!") and when the final table forms.
- **Session moods** (`src/bots/session-mood.ts`, cash only): each player arrives in a mood for the session.

  | Mood | Play | Leaving |
  |---|---|---|
  | Grinding | A bit tighter and sharper | Normal |
  | Out for fun | Looser, more aggressive | Stays longer |
  | Tired | More mistakes, more passive | Leaves sooner |
  | Confident | More aggressive | A bit longer |

  - **Who gets which:** recreational players are most often out for fun, regulars grinding.
  - **Talk:** a newcomer (and one starting player after the first hand) says how the night is going in the table news ("Long day.", "Let's gamble!").
- **Compatibility:** older layers and policies replay unchanged. Designed, not fitted.

## Patch 49: calling stations and barrels (cash human-1.17.0, tournament 2.20.0)
- **Giving up to barrels** (`barrelFoldPlay` in `src/bots/barrels.ts`): stations (and station-like players) and passive regulars still call one bet light.
  - **When they fold:** facing a second or third big bet (half the pot or more, on the turn or river, after calling an earlier street), they let go of weak pairs and ace-high.
  - **How often:** about 50% for stations and 40% for passive regulars, and 30% more often on a third barrel.
  - **Exceptions:** a pair they like, a real draw on the turn, or a hand that plays the board still calls.
- **Value-betting a known station** (`stationValuePlay`): when the public table reads mark the key opponent as a calling station, thinking players bet medium-strong hands on the turn and river when checked to (70% of the pot) and size value bets up to 85% of the pot. How much they adjust follows skill and how long the reads have run.
- **Measured on Version 61** (8 tables × 300 hands each, one run per layer, about ±5 points):

  | | 1.16.0 | 1.17.0 |
  |---|---|---|
  | Station went to showdown | 43% | 43% |
  | Passive regular went to showdown | 41% | 44% |
  | Station fold to river bet | 41% | 46% |

  - **Already below 45%:** stations were already under 45% to showdown on Version 61 before this patch. Version 61's corrections, together with patches 45–48, brought them down from the 49–53% seen in my older tree.
  - **Why this patch adds little:** about half of station showdowns are checked down and a third see no postflop bet, so they never face the barrels this patch changes.
- **Decision hashes:** they record the station-value and barrel plays.
- **Compatibility:** older layers and policies replay unchanged. Designed, not fitted.

## Patch 50: hand-reading mistakes (cash human-1.18.0, tournament 2.21.0)
- **What** (`src/bots/misreads.ts`): weaker, careless players sometimes misread the board.
  - **They miss a board flush or straight:** four of a suit, or four cards to a straight, that their hand does not beat, and keep calling or bet for "value".
  - **They think a board pair is theirs:** they call or bet with nothing on a paired board.
  - **When:** only in the spots where the misread changes the action.
- **How often:** none for skilled players (Hiro never). For the weakest, careless players, about a quarter of the time when facing a bet of up to three-quarters of the pot (never for more than a third of their stack), and somewhat more when checked to.
- **Talk:** after losing a river call in such a spot, the player sometimes says so ("Didn't see the flush.", "I thought I had a pair.").
- **Measured** (8 tables × 300 hands, about ±5 points):

  | | First setting | Final setting |
  |---|---|---|
  | Stations to showdown | 51% | 48% |
  | Passive regulars to showdown | 47% | 42% |
  | Stations fold to river bet | 33% | 38% |

  At 1.17.0 the same numbers were 43%, 44% and 46%. Misreads make weak players call more, so they push station showdowns up a few points, which is the realistic direction for misreads but works against patch 49.
- **Decision hashes:** they record the misread play.
- **Compatibility:** older layers and policies replay unchanged. Designed, not fitted.

## Patch 62: table craft and late-game tournament play (cash human-1.19.0, tournament 2.22.0)
- **What, cash and tournaments** (`src/bots/table-craft.ts`):
  - **Float:** in position, heads-up, a thinking player calls a flop c-bet of up to three-quarters pot with some equity (a pair, a draw or two overcards).
  - **Float bet:** after floating, they bet the turn when the preflop raiser checks to them.
  - **Probe:** out of position, they lead the turn or river after the preflop raiser checked the street before.
  - **Blind defense:** against a single cutoff, button or small-blind open of up to 4 big blinds, the blinds defend wider and some re-steal with a light 3-bet. Nits give their blinds up more. Loose recreational players call from the big blind because they are already in.
  - **Size reads:** a skilled player who has seen someone's big turn and river bets always turn out strong (at least three shown down, at least 80% strong) folds more to the next big bet; one who has seen small bets turn out weak (at least three, at least 70%) calls them lighter. Evidence is only what that observer witnessed: in cash, the latest 150 hands this session with both of them seated and the same occupant; in tournaments, the same Hero-table window as the other reads. Showdown cards come only from hands shown down.
  - **Multiway preflop:** behind a raise and a caller, disciplined players fold loose cold calls and turn light 3-bets into flats or folds.
- **What, tournaments only** (`src/tournament/late-game.ts`):
  - **Late steals:** folded to in the cutoff, button or small blind, with antes in and 15–60 big blinds, thinking players open wider.
  - **Re-steals:** with 15–25 big blinds, facing a single late open with no callers, they shove strong-but-not-premium hands.
  - **Pay-jump caution:** at a final table, a medium stack facing an all-in for at least 40% of their stack folds marginal calls, more when the next real pay jump is bigger and when a shorter stack is still at the table.
  - **Short-stack desperation:** under 8 big blinds and first in, skilled players about to hit the blinds shove wider; weak players sometimes wait too long for a hand.
- **What, cash churn** (`src/session/churn.ts`): a deep loser (down 250 big blinds or more) who is not tilt-prone usually stops rebuying ("hits their limit"); tilters reload with a word; strong regulars top back up when below 85% of their buy-in; regulars lock up smaller wins (60 big blinds or more) sooner; recreational players up 150 big blinds or more sometimes book the win and leave.
- **How often:** follows a craft score from skill and aggression. Hiro, Priya and Viktor play it fully; Big Earl, stations and passive regulars never float, probe or steal back.
- **Measured** (6 tables × 300 hands, about ±5 points; lineups change with churn, so per-type columns are noisy):

  | | 1.18.0 | 1.19.0 |
  |---|---|---|
  | Blinds fold to a cutoff or button steal | 71% | 60% |
  | New plays per 1,000 bot decisions | 0 | about 8 |

  The first setting (defense at most 70% of craft, big-blind floor K9o) moved fold-to-steal only to 76%, within noise; the final setting defends K7o-type hands, scales with craft, and adds the loose "already in" call. Live low-stakes blinds fold to steals roughly 55–65% of the time.
  In tournaments the late-game plays are spot plays: over 4 simulated 18-player daily events (antes in) they fired in about 0.2% of Hero-table bot decisions (late steals, defenses), on top of the existing push/fold and bubble play.
- **Decision hashes:** cash records the craft plays and a size-read digest; tournaments record the late-game plays, the craft plays and the size-read digest, and the push/fold path records desperation and pay-jump plays.
- **Compatibility:** older layers and policies replay unchanged: size reads are computed only for the new versions. Designed, not fitted.

## Patch 64: tells, speech play and reading your timing (cash human-1.20.0)
- **Tells** (`src/bots/tells.ts`, screen only; they never change a decision):
  - Each player has their own style: a leak rate, a timing habit (a long theatrical pause with strength, or betting it instantly), a speech habit ("weak means strong" actors, quiet types, or none), one body cue for strength and one for weakness.
  - **Timing:** applied to the think time of bets, raises and calls (snap-calling draws, long pause before a big bet, and so on).
  - **Body cues** (on the seat while deciding, with a matching portrait motion): eyes their chips, shaky hands, looks away, goes still (strength); stares at you, leans in, shrugs, taps the table (weakness).
  - **Speech:** actors say "I guess I'll bet" with a monster and talk tough when bluffing; quiet types talk when bluffing. Facing your bet they may ask "Do you have it?" (unsure) or "How much do you have behind?" (strong).
  - **Who leaks:** rate falls from about 70% of eligible decisions for the weakest players to a few percent for Hiro.
  - **Fake tells:** skilled players (skill 0.65+) reverse up to 45% of the tells they give.
  - Deterministic per decision, and based on the player's real cards at that moment.
- **Interaction** (screen only): a needle from the bettor after you fold to them (honest talkers tell the truth, actors the opposite), and showdown reactions to a bluff caught either way ("You caught me." / "Knew it.").
- **Reading your timing** (`src/bots/tempo-reads.ts`, layer 1.20.0, changes decisions):
  - Your actions on a 1.20.0 table record only whether you snapped (under 1.5 s) or took 7 s or more. Pre-selected actions and a hidden tab record nothing.
  - A player with skill 0.45 or more who has watched your snap (or slow) turn and river bets shown down strong at least 3 times and at least 75% of the time folds more marginal calls against the next one. If they turned out weak at least 65% of the time, the player calls lighter.
  - Evidence: only hands that observer witnessed, and only your shown-down cards. They say so when they act on it.
- **Coaching** (`src/ui/tell-coach.ts`): the session recap lists up to four tells shown by players whose cards were then shown down. It puts first the tells you acted against, and the fake ones.
- **Decision hashes:** cash adds `:human-1.20.0:` and `:tempo:<play>:<digest>`.
- **Compatibility:** older layers and policies replay unchanged. Designed, not fitted.

## Patch 66: tournament tells and timing reads (tournament 2.23.0)
- **What:**
  - Tournament tables now show the Patch 64 body cues while a player decides, their speech tells, the question asked when they face your bet, and the needle after you fold to them. These are screen only.
  - **Timing reads (2.23.0, changes decisions):** your action records whether you snapped (under 1.5 s) or took 7 s or more, in the decision id (`tournament-hero:<hand>:<revision>:snap|tank`).
  - A skilled player who has watched your timed turn and river bets shown down reads them, with the same rules and thresholds as cash layer 1.20.0. Evidence comes only from Hero-table hands that observer witnessed, and only from your shown-down cards.
  - They say so when they act on it.
- **Decision hashes:** tournaments add `:tempo:<play>:<digest>`.
- **Compatibility:** older policies replay unchanged. Designed, not fitted.

## Patch 68: remembering you across sessions (cash human-1.21.0)
- **What:**
  - A player's evidence about you now covers every saved hand they sat in with you, in any session, not only this session.
  - That evidence is your timing (Patch 64) and what your shown-down river bets turned out to be.
  - Regulars are the same person every visit, so their memory carries over; strangers have only met you today.
- **River memory:** a player with skill 0.4 or more who has seen at least 4 of your river bets shown down:
  - calls lighter when 40% or more of them were bluffs or thin;
  - folds more when at least 5 were all strong.
- **What you see:** on your first hand of a session, a regular who remembers you says so ("You again. Still snap-betting your big hands?", "Careful, everyone. This one bluffs rivers."). When they act on the memory they say so too.
- **Evidence:** the saved hands kept on this device (the latest 400 at most), and only your shown-down cards.
- **Decision hashes:** cash adds `:memory:<play>:<strong/weak>:<hands together>`.
- **Fix:** on 1.20.0 and later tables, an action with no timing recorded no longer gets a stray suffix on its decision id.
- **Compatibility:** older layers replay unchanged. Designed, not fitted.
