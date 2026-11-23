## Version56 candidate — witnessed table image and scare cards

Patch38/0009 integrated on saved Version55. New cash human1.7 and tournament2.10 add authored showdown image and texture behavior. Corrected river-only bluff attribution, private-strength/shared-nut/draw boundaries, observer identity and cache isolation, and full numeric image fingerprints. Historical decision/hash/RNG paths remain intact. Full suite passes (see exact totals in `TEST_EVIDENCE/version56/QUALIFICATION.md`), as do lint/typecheck/build/spec checks. Browser30cashhands at three widths with audit/exact reload and a complete27-player event with two moves and reload pass. Image actions were verified with constructed fixtures; the30-hand browser sample produced no qualifying image signals. Off-table MTT image history remains unavailable. Earlier storage interruptions remain unresolved; physicaliPhone/Safari/VoiceOver and fullPlaywrightCLI not executed. **NOT READY FOR R1; save without deployment.**

## Version55 candidate — multiway pots and sizing habits

Patch37/0008 integrated on saved Version54. New cash human1.6 and tournament2.9 add authored multiway discipline and sizing habits, with denomination, genuine private-strength, draw/shared-nut and edited-profile repairs. Historical decision/hash/RNG paths and Version54 engine/push-fold safeguards remain intact. Full suite3,206pass/1new-fixture failure/9existing optional skips; the corrected complete3-test file and all17independent checks pass, giving passing results for all3,207non-skipped cases across the full run and recheck, not a second clean full run. Lint/typecheck/build/spec pass. Browser30cashhands at three widths with multiway pots, straddles, churn and exact reload/audit, plus a complete27-player event with two moves and reload, pass. Earlier storage interruptions remain unresolved; no physicaliPhone/Safari/VoiceOver or fullPlaywrightCLI claim. See `TEST_EVIDENCE/version55/QUALIFICATION.md` and `REVIEW.md`. **NOT READY FOR R1; save without deployment.**

## Version54 candidate — push/fold and live UTG straddles

Patch36/0007 integrated on saved Version53. New tournament policy2.8 uses reviewed contestable call pricing, responder exposure and stable ICM identities; new cash human1.5 supports optional live UTG straddles. Straddle-capable profiles use engine0.6.0; ordinary0.4 and tournament0.5 remain unchanged, with exact Version53 non-straddle state/frame compatibility and authentic0.3 migration tests. Full suite3,182pass/1fixture failure/9existing optional skips; the corrected complete17-test file passes, giving passing results for all3,183non-skipped cases across the full run and recheck, not a second clean full run. Lint/typecheck/build/spec pass. Browser30cashhands at three widths with straddles and audit/reload, plus a complete27-player event with reload and a table move, pass. Prior storage interruptions remain unresolved; no physicaliPhone/Safari/VoiceOver or fullPlaywrightCLI claim. See `TEST_EVIDENCE/version54/QUALIFICATION.md` and `REVIEW.md`. **NOT READY FOR R1; save without deployment.**

## Version53 candidate — buy-in depth and opponent reads

Patch35/0006 integrated on saved Version52; patches30–34 already present. New cash1.4 and tournament2.7 add authored buy-in/depth tendencies and witnessed public opponent reads. Corrected effective-bettor depth, edited-regular styles, compaction/identity/witness boundaries, numeric read fingerprints; retained Version52 churn, ICM and legacy decision paths. Full suite3,138pass/7stale-fixture failures/9existing optional skips; all48cases in the four corrected files pass on complete-file rechecks. All3,145non-skipped cases therefore have passing executed results across full run and rechecks, not a second clean full run. Lint/typecheck/build/spec pass. Browser30cashhands at three widths plus styled buy-ins and a complete27-player event with reload passed. Prior browser storage interruptions remain unresolved. See `TEST_EVIDENCE/version53/QUALIFICATION.md` and `REVIEW.md`. No physicaliPhone/Safari/VoiceOver/fullPlaywrightCLI claim. **NOT READY FOR R1; save without deployment.**

## Version52 candidate — cash churn and final-table ICM

Patch34 integrated on saved Version51; patches30–33 were already present. New cash tables use human-1.3.0 and new events policy2.6.0. Corrected cumulative-memory churn, multiple-bust funding, one-shot names, top-up settings, ICM player mappings and decision fingerprints. Full Vitest:3,109pass/1stale-testfailure/9existing optional skips; corrected complete28-test file passed, so all3,110non-skipped cases have passing executed results across the full run and recheck. No second full run after that test-only correction. Lint/typecheck/build/spec passed. Fresh60-hand cash browser audit/reload passed; a segmented27-player event finished. An earlier browser storage interruption/lost isolated tournament save remains unresolved, alongside Version51's stall; do not claim clean browser qualification. See `TEST_EVIDENCE/version52/QUALIFICATION.md` and `REVIEW.md`. Exact ICM equity feeds a heuristic preflop risk adjustment, not exact callEV or postflopstrategy. Physical iPhone/Safari/VoiceOver and broader gates remain open. **NOT READY FOR R1; save without deployment.**

## Version51 candidate — live-player habits and stakes cast

Patch33 integrated on saved Version50; patches30–32 were already present. New cash tables use human-1.2.0 and new events policy2.5.0/cast-2. Added40regulars grouped by stakes and authored live-player habits; corrected edited-profile overrides, limp-call and float/delayed-turn boundaries while retaining Version50 memory/recovery fixes. Full suite: **3,086 passed,0failed,9existing optional skips** across293files. Final lint/typecheck/build/spec integrity and cash/menu browser workflows passed. A27-player browser event stalled at hand43 and required reloads; the cause is unresolved, and the resumed outcome is recorded separately. Do not describe that as an uninterrupted browser pass. See `TEST_EVIDENCE/version51/QUALIFICATION.md` and `REVIEW.md`. Physical iPhone/Safari/VoiceOver, the browser-stall investigation and broader R1 gates remain open. **NOT READY FOR R1; save without deployment.**

## Version50 candidate — public reads, moods and table talk

Patch32 integrated on saved Version49; patches30/31 were already present. New cash tables use human-1.1.0 and new events policy2.4.0. Corrected all-in/dead-button read classification, witnessed-only regular memory, archive retention/fatigue counters, emergency-runtime memory catch-up and clipped phone talk bubbles. Clean full suite: **3,049 passed, 0 failed, 9 existing optional skips** across291 files. Typecheck, lint, build, specification integrity, full90-player controller event, complete27-player phone-sized browser event, cash pending/settled/cashout reloads and two phone talk layouts passed. See `TEST_EVIDENCE/version50/QUALIFICATION.md` and `REVIEW.md`. The initial two full-suite failures and their repairs are retained in evidence. Physical iPhone/Safari/VoiceOver, full Playwright CLI and broader release gates remain open. **NOT READY FOR R1; save without deployment.**

## Version49 candidate — human touches

Patch31 integrated on saved Version48 (patch30 already present). New cash tables and tournament policy2.3.0 add bounded mood, rounded bet amounts and variable think time; older sessions/events retain their decisions. Corrected multi-table archive-window mood loss, pot-sensitive timing, tournament scheduling and historical provenance labeling. Full suite: **3,026 passed,0failed,9existing optional skips**. Typecheck,lint,build,spec integrity,complete90-player controller event and cash/27-player phone-sized browser workflows passed. See `TEST_EVIDENCE/version49/QUALIFICATION.md` and `REVIEW.md`. No measured-human calibration or strength gain is claimed; physical iPhone/Safari/VoiceOver and broader gates remain open. **NOT READY FOR R1; save without deployment.**

## Version 48 candidate — tournament stats and regulars

Patch 30 integrated on saved Version 47. Stats → Tourneys adds filtered results and public-hand comparisons; twenty named regulars are available in cash setup and new tournament fields. New events use policy 2.2.0; prior policies and prepared saves remain compatible. Corrected dead-button position statistics, returning-player all-in opportunities, MTT bust timestamps and complete chart text data; preserved Version 47 fingerprints. Full suite: **3,005 passed, 0 failed, 9 existing optional skips**, plus two late chart/date regressions passed separately. Typecheck, lint, production build, spec integrity, a complete 90-player controller event and a complete 27-player phone-sized browser event passed. See `TEST_EVIDENCE/version48/QUALIFICATION.md` and `REVIEW.md`. New physical iPhone/Safari/VoiceOver and broader release gates remain open. **NOT READY FOR R1; save without deployment.**

# AI Texas Hold Em — Step5C

## Version 47 candidate — bubble context and other-table preparation

Patch 29 integrated on Version 46. New events use policy 2.1 with public standings; older policies retain their behavior. Other-table work begins while Hero plays and remains subject to the validated round commit. Corrected the new fingerprint to include the complete public stack distribution. Full suite: **2,921 passed, 0 failed, 9 existing optional skips**. Complete 90-player controller event and 27-player phone-sized Chrome playthrough passed, including reload and table-move handling. See `TEST_EVIDENCE/version47/QUALIFICATION.md` and `REVIEW.md`. Physical Safari/iPhone/VoiceOver and phone timing remain open; no proven strength gain or ICM model is claimed. **NOT READY FOR R1; save without deployment.**

## Version 46 candidate — tournament policy 2

Patches 27/28 integrated on Version 45. New events use policy 2; existing version-1 and unversioned tournaments retain their decisions and replay. Full suite: 2,888 passed, 0 failed, 9 existing optional skips; six additional independent compatibility tests passed. A complete 90-player controller event and a complete 27-player phone-sized Chrome event passed, including reload and table-move handling. See `TEST_EVIDENCE/version46/QUALIFICATION.md` and `REVIEW.md`. Strength estimates remain upstream evidence; physical iPhone/Safari/VoiceOver and broader R1 gates remain open. **NOT READY FOR R1; save without deployment.**

The Step5C and later chronological entries below retain their historical scope and evidence.

**NOT READY FOR R1. Version7 remains live; save the candidate without deployment.**

Production checkpoint `c71e63289635fa256cd93ba948e66a2bcbf7b222`: verified recovery audit reuse, frozen asynchronous transport boundaries, zero-net settlement protection, measured cooperative recovery/statistics, bounded public-memory freezing, atomic migration backup/receipt, frozen V7-R compatible rollback, quiet-save control repair and accessibility/import-rights improvements. Engine0.4.0 and policy1.6.0 are unchanged.

Executed full suite: **1363/1363PASS,153files,0fail/0skip**, including enabled PokerKit and20,000-hand accounting; specification/typecheck/lint/buildPASS. Two further independent queue-failure tests also passed. Browser100hands before final scheduling refinements plus25final-candidate hands; pending/postpayoutreload, native quota/lost-ack/two-tab and populated V7→candidate→V7-R→candidate checks pass. Exact built-artifact accounting and trusted keyboard navigation passed. Physical screen-reader/device checks and iPhone export are not claimed.

Native10k recovery70.95→40.32s; maximum observed long task53.15s→495ms. Five-thousand-hand final observations45.34s and17.99s are both retained; variability remains unresolved. The original9.79s bot outlier remains unattributed. Latest5,000-preparation reference p95=25.02ms,max750.62ms primarilyGC;20,000 instrumented preparations acrossfourruns preserve identical accounting endpoints.

**302originals:217PASS/0FAIL/5BLOCKED/80NOT_EXECUTED.** Eleven mandatory R1 gates remain. Y10 andV706 remain wholeNOT_EXECUTED with explicitly authorized cash componentsPASS; no new feature deferral. All86futurefeatures and governing package hashes are preserved. See [STEP5C_REPORT.md](STEP5C_REPORT.md), [R1_DASHBOARD.md](R1_DASHBOARD.md) and exact execution receipts. Next: large-save recovery architecture and variability, effective-evidence mapping/CI, then actual device/screen-reader/new-user checks. No production deployment until all mandatory gates pass.

---

Historical Step5B and earlier reports below preserve their original evidence and limitations; they are not current status.

# AI Texas Hold Em — Step5B

**NOT READY FOR R1. Version7 remains live.** Continue the existing project only. All302original requirements and86deferred features remain preserved; source status is `ACCEPTANCE_STATUS.csv`, with generated `R1_DASHBOARD.md` and executable release gate.

Implemented measured incremental integrity/storage/statistics/public-memory processing, all18original cash feature gaps (V706 explicitly mixed deferred straddle scope), immutable configuration history, notes, import/reset/privacy fixes and synthetic policy1.6. Historical policies through1.5 remain frozen and supported. No engine financial authority was moved to UI or bots.

Final full suite at`d5f2aef`:1263/1263PASS,138files,0fail/0skip; enabled PokerKit and20k accounting checks; typecheck/lint/buildPASS. Current1.6 browser25hands/all10occupied and exact pending/postpayoutreload passed; previous1.5 browser100hands audited. Paired100-history6seat browser botprep p95643.2→28.5ms. Full10kresource run, archive and independent current-source restore agree financially; large cold recovery still39–56seconds, one9.79secondhot outlier unattributed and residualmemory unclassified. ActualV7 downgrade refuses safely; it is not a working rollback, so Z03remainsFAIL. PhysicaliPhoneexport remainsAWAITING USER VERIFICATION.

See `STEP5B_REPORT.md`, final-pass evidence, benchmark/resource reports and the reconciled R1 dashboard. Next: measured cold recovery/audit deduplication and heap-retainer work; compatible rollback; remaining required device/accessibility/new-user/provenance/CI checks. Do not publish while required gates remain unresolved. Do not start tournaments or unrelated variants.

---

Historical Step5A and Step4C reports below are retained as prior evidence; their counts and next steps are not current status.

# AI Texas Hold Em — Step5A

**NOT READY FOR R1. Version7 remains published; Step5A source is tested but not deployed.** User explicitly conditioned publication on release checks passing. Continue the same Site; do not create another project or touch Poker MaxEV.

Final runtime `727371f`: policy1.3 fixes guaranteed negative-rake HU board-chop calls and forced-preflop-runout rake pricing. Version1.2 frozen under bots/v3, older dispatch retained. Storage loading UI hides false default balances. Public history exports preserve safe frozen policy-version metadata; no saved-data schema or historical-record rewrite. Authoritative engine, cash controller, stats, browser persistence and table geometry unchanged.

Executed572/572 tests in73files,0failures/skips; integrity/typecheck/lint/build PASS. Manifest: TEST_EVIDENCE/2026-11-01T03-19-50-995Z/manifest.json. Prior527PASS/10stale-version-assertionFAIL and clean537PASS reruns retained. Browser212new hands (211candidate,1published),105layout cases,4populated migrations×19checks, exact four-street reload, pending-write/payout-ACK recovery, multi-tab fencing, repeated cashouts, manual edits/topups, public download/fallback/import/replay. Ten-seat100hand run had36hands with10funded and64with9; no invented refills. Public217-record accounting audit includes5existing published records. Final policy-export patch additionally smoke-tested5HUhands. See STEP5A_REPORT.md and TEST_EVIDENCE/step5a/BROWSER.md.

Acceptance tracker updated:114PASS/18FAIL/5BLOCKED/165NOT_EXECUTED across302. R1cash-component coverage120PASS/18FAIL/0BLOCKED/99NOT_EXECUTED across237release-critical gates (6mixed cash/tournament rows split without rewriting criteria). All302 original criteria and86deferred items hash-verified. R1_REQUIREMENTS.csv and R1_DASHBOARD.md classify every row; missing tournaments do not block cash.

Release blockers:18criteria cover11missing cash feature groups; long-session historical hashing/copying causes p95botprepare719/723ms and3.15s/2.73s long tasks. Independent no-UI profile confirms63→626ms median from10→100saved hands. No unsafe validation bypass. Full bounded-storage/resource/device/user gates unexecuted. Preserve synthetic labels: independent expert review and measured-human calibration absent; original0/30probe unchanged and strategic risk/range limitations disclosed. Physical iPhone export AWAITING USER VERIFICATION; prior user4/5checks retained. Cloud embedded-frame blob download capture unsupported;390px select-all fallback/import/replay passed and desktop actual downloads passed.

Next implementation: optimize redundant whole-history processing with explicit immutable-prefix/ownership/integrity proofs; profile isolated25/100/500-hand saved data, rerun failures/restore/ownership/migrations and100-hand9/10seat UI tests. Then close mandatory feature gaps and remaining exact criteria. Do not move to tournaments/new archetypes.

## Prior Step4C publication evidence

Published Version7 at https://ai-texas-hold-em.stevemccutcheon89.chatgpt.site/ from a0bfc0950771a6dc1b786e00c13be7f3485b8dcb. Existing project only. V7 governing packages, all302 original requirements and86 deferred entries remain hash-verified. Runtime policy synthetic-cash-1.2.0 corrects first-in position/initiative handling and capped-call/side-pot pricing. Frozen1.1,1.0 and phase0 sessions remain supported. Core engine, ledger, persistence schema and mobile seating are unchanged.

Executed full integration:480/480 tests PASS,58files, zero failures/skips, including PokerKit0.7.7 compatible fixtures and20,000 accounting hands; integrity/typecheck/lint/build PASS. Subsequent independent-evaluator assertions passed17/17; a TypeScript narrowing defect in that helper was caught and fixed before publication. The complete480-test release gate then passed again, with typecheck/lint/build/integrity. Final manifest: TEST_EVIDENCE/2026-11-01T02-12-48-035Z/manifest.json. Browser:20 real UI hands,105 responsive cases,21 public hand event audits including an additional real IndexedDB reload/split-pot/cashout journey. Published Version7 then completed one additional guest hand with queued exit/reload and single cashout; prior four records remained byte-for-byte equal as parsed public records. Total22 newly played browser hands. Publication/live-origin proof is recorded in TEST_EVIDENCE/step4c/publication.json (native success verified).

Independent evaluation retained13,824 completed experimental hands,84,516 legal actions and98,304 separate conditional samples. Preflop exact matrix has1,288 configurations and344,064 paired proposals. These are not V7 acceptance counts. Tracker remains76PASS/0FAIL/5BLOCKED/221NOT_EXECUTED, with current evidence and partial gaps recorded.

A mechanics and B functional synthetic policy scope pass; C external expert review and D measured-human validation do not. Pressure-probe weaknesses and sparse sizing/river cells remain. Recommend further adaptation/rare-tail refinement before full realism or R1 cash-release signoff. G3 conditional user signoff remains; physical-iPhone export is AWAITING USER VERIFICATION. See STEP4C_REPORT.md, tests/step4c/VERIFICATION.md and TEST_EVIDENCE/step4c/BROWSER.md.

## Version 34 tournament milestone
Single-table home freezeouts are implemented for6/9 entrants: authoritative tournament rules, independent tournament wallet/results, transactional recovery, legal controls, eliminations/prizes and spectator continuation. See TOURNAMENT34_REPORT.md and TEST_EVIDENCE/tournament34 for exact executed scope and defects. Multi-table fields remain unavailable previews; full tournament strategic adaptation/replay UI and external release qualification remain incomplete. Do not infer R1 readiness or deploy productionVersion7 from this milestone.

## Version35 tournament review repairs

Patch17 and review repairs are documented in TOURNAMENT35_REPORT.md. New tournament genesis is $2,000; legacy $100,000 genesis and existing balances are preserved. Format2 stores immutable completed archives separately from verified active/financial checkpoints; full audit is required on recovery. A new versioned synthetic short-stack policy applies only to new events. Cash engine authority is unchanged. Post-bust fast-forward executes every normal engine action and settlement; previous snapshots offer audited private export, never silent rollback. Version34 cannot read format2. Physical devices, VoiceOver and full tournament strategic acceptance remain unverified.

## Version36 blackjack foundation
Revised Patch18 adds the catalogue and practice coaches; live blackjack remains unavailable. B1 classic engine and replay/accounting tests are headless only. Confirmed default is50¢ once per round, including splits, with separate$2,000 intended genesis. Approximate advice is explicitly labelled; no independently verified count indices or measured house edge. See BLACKJACK36_REPORT.md. Original302acceptance/86future registers unchanged; productionVersion7 unchanged.

## Version37 playable blackjack milestone
Eight classic tables are connected to the authoritative engine, separate $2,000 wallet, one-round50¢ casino ante, transactional save/reload, visible-card coaches and public export. Finished shoes are archived once; hot actions replay only current shoe. Free Bet/side bets and independently verified strategy remain unfinished. See BLACKJACK37_REPORT.md and TEST_EVIDENCE/blackjack37; no original R1 gate is promoted by these new tests. ProductionVersion7 remains unchanged.

## Version38 count-coach milestone
Ace side tallies are available for every counting method, including a new Wong Halves ×2 whole-number option. Live/public-only counts, dual-answer practice grading and consistently scaled experimental indices are tested. No blackjack/poker financial schema or authoritative game engine changed. See BLACKJACK38_REPORT.md and TEST_EVIDENCE/blackjack38. This is an R1 test-site update, not release signoff.

## Version39 live coach and Test me
Patch19 adds the public count strip, approximate count-aware advice/insurance, quiet after-action feedback and explicit ante result wording. The engine, financial persistence and strategy calculation are unchanged. Insurance prose now accurately labels approximate advice. See BLACKJACK39_REPORT.md and TEST_EVIDENCE/blackjack39 for executed tests and the corrected even-money browser expectation. Prior owner device confirmation remains Version38-specific; new controls still need physical checks. Original302/86 registers and productionVersion7 remain unchanged.

## Version40 Patch20 foundation (unpublished)
Pure side-bet rules, seat policies and optional screen contracts integrated; existing live blackjack remains unchanged. Name escaping, waiting-state action disabling and input boundaries hardened. See BLACKJACK40_REPORT.md. Side bets and other seats are not yet wired into the authoritative engine/financial journal. R1 stays onVersion39; no release claim.

## Version 41 — Patch 21 casino-table presentation (save only)
Casino felt/cards/chips integrated; live 320x568 post-Deal count and hand fit verified. Accessible dealer-rule fallback corrected. Full suite 2731 PASS / 0 FAIL / 9 opt-in SKIP; current live browser regression 54 checks / 48 rounds PASS. Seven-seat sample overlap remains documented; side bets/full table not made playable. See BLACKJACK41_REPORT.md. Production V7 and R1 V39 unchanged.

## Version 42 — Patch 22 seated blackjack (save only)
Playable 2/4/6 computer-player tables integrated with casino dealing order, shared-shoe counts, isolated Hero ledger and exact replay. Independent review caught and corrected the low-shoe forced-stand defect; full tables now shuffle earlier between rounds under frozen seat-styles-2. See BLACKJACK42_REPORT.md and TEST_EVIDENCE/blackjack42. Browser evidence: 108 seated rounds / 27 configurations and 48 heads-up rounds / 54 checks. Physical checks, paced dealing, full-seat public export and side bets remain open. Production V7 and R1 V39 unchanged.

## Version 43 — Patch 23 paced dealing (save only)
Full-table Slow/Casino/Fast reveals and Show all integrated. Counts/quiz grading follow exposed cards; balance, split movement, double markers and completed-seat announcements no longer reveal future state. V42 engine/reserve/save authority unchanged. Full suite 2772 PASS / 0 FAIL / 9 opt-in SKIP; final focused 19 PASS. Final paced browser 27 rounds / 9 configurations / 3275 observations; heads-up 48 rounds / 54 checks PASS. See BLACKJACK43_REPORT.md. New physical Safari/VoiceOver checks remain open. Production V7 and R1 V39 unchanged. NOT READY FOR R1.

## Version 44 — Patch 24 reveal polish (save only)
Empty hands omit zero totals and have a no-cards accessible label; empty dealer area says Dealing during reveals; disabled actions are visually dimmed. V43 reveal/engine/persistence logic unchanged. Blackjack regressions 382 PASS / 0 FAIL / 0 SKIP; lint/build/specification integrity PASS. Browser 27 rounds / 9 configurations / 3342 observations PASS. Full unrelated project suite not rerun. See BLACKJACK44_REPORT.md. Production V7 and R1 V39 unchanged; physical Safari/VoiceOver and remaining R1 gates stay open.

## Version 45 candidate — multi-table tournaments

Patch 25/26 integrated on Version 44, with independent round-chain audit, forced-all-in history retention and table-move gating/focus corrections. Evidence: `TEST_EVIDENCE/version45/REVIEW.md` and `QUALIFICATION.md`. Preserve the 302 original acceptance records and 86 deferred IDs. **NOT READY FOR R1; save without deployment.** New browser/mobile/VoiceOver checks remain unexecuted because preview browser connection failed. Existing synthetic opponent policy is unchanged.

## Version57 — Patch39 (save only)

New cash human1.8 and tournament2.11 add heads-up betting opportunities and deep-stack preflop raising adjustments. Independent integration corrected effective-depth, all-in, positional-order, initiative and hand-classification boundaries. Historical branches are covered by captured Version56 cash/tournament golden fixtures. See TEST_EVIDENCE/version57 for final executed checks and remaining limits. No deployment or R1 gate promotion.

Version57 executed evidence: complete Vitest3256pass/2stale-version failures/9optional skips, followed by33/33passing tests across both corrected files and the exit suite. Final lint/build/spec integrity passed. Browser30cashhands across320/390/1366px and a complete27-player phone event passed. No entirely clean full-suite rerun after test-only version updates; logs explicitly retain failures and passing reruns. No deployment.

## Version58 — Patch40 (save only)

Patch0011 adds postflop fights and river decisions to new cash human1.9 and tournament2.12 games. Integration corrected positional/history evidence, private hand/draw classification, side-pot call pricing and nuts protection. Captured Version57 golden fixtures verify historical cash1.8 and tournament2.11 decisions, hashes and RNG behavior. No hand engine or financial schema change; no deployment or R1 gate promotion. Final executed checks and remaining limits are recorded in TEST_EVIDENCE/version58.

Version58 executed evidence: full Vitest3279pass/1stale-seat-fixture failure/9optional skips; corrected whole-file rerun12/12pass. Final lint/build/spec integrity passed. Browser30cashhands across320/390/1366px and a complete27-player phone event passed, including one table move and exact reload. No second full-suite run after the test-only correction; no deployment.

## Version59 — Patch41

Patch0012 adds authored postflop corrections and bounded rivalries to new cash1.10/tournament2.13 games. Integration corrected full/compact history equivalence, side-pot attribution, half-stack exposure after sizing, private hand/draw classification and grudge-talk cache/eligibility boundaries. Captured Version58 golden fixtures protect historical cash1.9/tournament2.12 decisions and RNG. No hand engine, ledger or persistence-schema change. Exact executed checks are recorded in TEST_EVIDENCE/version59; no original302/86 or R1 gate promotion.

Version59 executed evidence: full Vitest3317PASS/0FAIL/9optionalSKIP in324passing files; lint/build/spec integrityPASS. Browser30cashhands across320/390/1366px plus exactreload, and a complete27-player phoneevent withone tablemovePASS. Save-only qualification; deployedVersion58 remains unchanged. No physicaldevice or fullPlaywrightCLI claim.


## Version60 — Patches42 and43 (save only)

New cash1.11/tournament2.14 add authored postflop initiative/price discipline and stage adjustments. New multi-table events support late arrivals and one bot re-entry through level4, with dynamic pool/fees/places and pending standings. Independent integration tightened effective-depth, private-strength, position, entry identity, payout and replay boundaries; Version59 golden fixtures protect historical decisions. No original302/86 acceptance or R1 gate promotion.

Executed evidence: full Vitest3363PASS/1test-fixtureFAIL/9optionalSKIP; corrected E07 whole-file rerun2/2PASS. Final lint/typecheck/build/spec integrityPASS. Browser30cashhands across320/390/1366px with exactreload, and complete27-player growing event with registration/reload/fast-forward/resultsPASS. No second full run after the test-only correction. See TEST_EVIDENCE/version60 for original failure, rerun and limits. Version58 remains deployed.


## Version61 — Patch44 (save only)

New cash1.12/tournament2.15 add signature leaks/recreational quirks, with exact authored-profile identity guards and corrected public-history/position/private-strength boundaries. Earlier fingerprints/caps and Version60 registration protections remain. Captured Version60 fixtures preserve32 cash and190 tournament decisions. Full suite3386PASS/2stale-versionFAIL/9optionalSKIP; corrected3-file rerun20/20PASS. Final lint/typecheck/build/spec integrityPASS. Actual browser30cashhands and27-player-start event with4moves/reload/finishPASS. No second full run after test-only assertion corrections. See TEST_EVIDENCE/version61 for raw evidence and limits. No R1 promotion; Version58 remains live.
