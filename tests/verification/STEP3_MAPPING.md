# Step 3 independent verification mapping

Authored tests are not acceptance passes. The integrator records actual revision, command, observed result and browser evidence only after execution.

| Requirement | Executable coverage | Scope caveat |
|---|---|---|
| C11 | controller.test.ts exact $1200/$300/-$40/+$1000/$40 scenario | Expected dollars derived directly from specified scenario. |
| C12, M01, V519 | Open-pot wallet edit and reset retain game/history; reset epoch | Reset is wallet-only, not history deletion; existing session/hand cohort remains frozen while wallet epoch increments. |
| C13 | New session after cashout retains old records/wallet/epoch | No history deletion or bankroll reset. |
| V613 | Fake-clock exact active/pause/closed-browser durations | Browser pacing and UI display remain separate evidence. |
| G06, V415 | Manual changes excluded; one buyin, topup, cashout; no phantom credit | Intentional later topups are distinct transactions. |
| M02, X03 | Rake-on settlement and transfers; engine side pots retained | X03 full mixed-stack browser journey additionally needed. |
| U14, V606 | Exact sealed state restore preflop/flop/turn/river; write failure rollback | Browser close/reopen and physical suspend remain separate evidence. |
| Z13, V703 | Persist reservation before draw, sealed decision before apply; restore no reroll; stale callback inert | Tests inject a calling policy to make expected sequences deterministic. |
| V512, V708 | Stale port CAS cannot overwrite; quota fail and lost acknowledgement | Real IndexedDB lease/multiple tabs and visible warning require browser execution. |
| V431, V510, V511, V607 | Public frame redaction, immutable finished records, malformed/hash/private injection rejection, no import credit | Public imports are study-only. Native private recovery is not public export. |
| M10 | Original profiles/results preserved after new archetype session | Full future policy-code migration is not implied. |
| G01–G03,G08,V421,V426 | Authority/stats lane owns independently expected metric tests | Opportunity definitions and unimplemented future metrics must be explicit. |
| M09,Z03 | Schema/version validation and migration lane | Rollback to older deployed app must not be claimed from unit-only tests. |

Browser journey authored in tests/browser/persistence.spec.ts is for an allowed compatible CI executor. In the managed Sites environment, actual browser testing is through Sites preview and cua_repl; do not execute a separate browser-control path. Required browser records: guest access; bankroll edit + reload; active hand every street; pending bot; post-payout reload; two tabs; cashier topup/cashout; public export/import; 360px mobile history export and no horizontal overflow. Any unexecuted case stays NOT_EXECUTED.

## Independent executed checkpoints and candidate rows

The following are candidate narrow acceptance passes after the integrator's final combined run; this file does not change ACCEPTANCE_STATUS.csv. Use the exact final run log, not these authorship notes, for evidence.

- **C11:** exact independent dollars fixture ($1,200 → buy $300 → loss $40 → external +$1,000 → top up $40): wallet $1,860, table $300, poker −$40, assets $2,160. Executed PASS.
- **C12, G06, M01, V519:** wallet edit/reset preserves in-progress cards/stacks/commitments and historic hand net. Reset appends an external event/new wallet epoch; current session cohort remains frozen. Executed PASS.
- **C13:** cashout/new session retains prior history/results, with no wallet reset. Executed PASS.
- **V415:** independent event-delta replay reconciles wallet and Hero table assets; concurrent transfers deduplicate, intentional subsequent topups remain distinct; negative/unaffordable/over-limit movements rejected. Executed PASS.
- **V703:** durable reservation before policy draw; sampled decision before engine command; saved/reconstructed decision survives crash, partial write and lost acknowledgement without duplicate hand-net. Executed PASS.
- **V431, V510, V511, V607:** public imports remain study-only; canonical engine replay rejects rehashed illegal amounts, changed action sequence and early hidden-card disclosure; unchanged financial history. Core replay plus controller cases executed PASS after the original two defects were repaired. Metadata regressions must also pass final run.
- **V606:** all four streets restore exact sealed game/deck/profiles/frames via persistence port. Executed PASS. Pair with actual browser reload proof before full browser-recovery acceptance.
- **V512/V708:** asynchronous adapter tests reject changed lease owner and stale snapshot revision; own expired lease can renew atomically. Failed quota and lost-ack controller tests preserve committed values. Executed PASS after own-expiry fix. Real IndexedDB/browser ownership and visible error tests are additional required evidence.
- **V613:** fake clock proves active milliseconds exclude explicit pause/offline interval; G01–G03 metric fixtures in stats suite preserve per-hand BB math. Actual browser pace comparison is separate; do not mark the broader row solely from this unit coverage.

Defect evidence found by this independent lane:
1. Rehashed early-complete replay could display opponent cards before permitted frame; fixed by canonical engine replay validation.
2. Rehashed balanced history with negative raise-to accepted; fixed by canonical engine replay validation.
3. `pagehide` removed the only `pageshow` handler, stranding a BFCache-restored closed connection; fixed by retaining a one-shot restore hook. Regression passed.
4. An uncontested expired writer lease rejected its original owner and could self-block Retry; fixed by atomic owner-token check/renewal, while changed-owner and revision fencing continue to pass.
5. Rehashed malformed hand metadata accepted (empty session ID, negative hand number, invalid date, reversed dates); fixed by metadata validation; all four adversarial regressions passed in final independent run.

Tests authored in `tests/browser/persistence.spec.ts` remain NOT_EXECUTED here. The independently executed logs were reported to the integration owner for preservation; actual deployment/browser evidence is produced by that owner.

Final independent focused execution: `npm test -- tests/step3 tests/storage tests/stats/cash.test.ts --reporter=verbose` at verification commit `6d5ffdc` (same controller/storage sources as main `cad4498`) passed **53/53 tests**, zero failures/skips: controller31, async ownership3, storage integrity3, stats16. Log supplied to integrator: `step3-verification-final.log`. All five defects listed above have passing regressions. This focused result does not substitute for the integrator full regression/oracle/build or actual browser record.
