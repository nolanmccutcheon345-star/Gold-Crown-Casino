# Step 5H — storage, candidate testing and release evidence

**NOT READY FOR R1.** The public Version 7 and original private Version 12 test Site are preserved. This report separates executed engineering evidence from physical-device, screen-reader, hosted-CI and human-study requirements.

## Storage finding and implemented correction

The reported 714.7 MB was the logical serialized value payload of the 10,000-hand fixture, not a browser-origin disk measurement. It included 217.1 MB of optional packed acceleration replicas in addition to the unchanged canonical records. These replicas had been retained for every historical hand.

New saves retain at most 120 recent packed replicas. Existing large saves use an explicit, guarded **Cashier → Reduce saved-history storage** action after cashing out. It fully verifies originals, financial reconciliation and the saved revision before an atomic replacement of the acceleration descriptor and retirement of redundant replicas. Missing/corrupt originals, ownership conflicts and interrupted writes refuse the change. Canonical records, original policy versions, financial events and rollback copies remain. No engine or bot-policy logic changed.

| Saved hands | Before logical bytes | After logical bytes | Saved bytes | Mean after bytes/hand |
|---:|---:|---:|---:|---:|
| 100 | 3,032,591 | 3,032,591 | 0 | 30,325.91 |
| 1,000 | 69,361,745 | 54,432,363 | 14,929,382 | 54,432.36 |
| 5,000 | 355,315,725 | 263,087,201 | 92,228,524 | 52,617.44 |
| 10,000 | 714,676,203 | 515,204,703 | 199,471,500 | 51,520.47 |

The 10,000-hand reduction is **27.91%**. The archive remains large; no claim of negligible storage or lower mobile memory follows. The fixtures differ in seat/action distributions, so these means are not a longitudinal marginal growth rate. Exact matched reports: [storage summary](tests/step5h-storage/summary.json) and [10,000-hand breakdown](tests/step5h-storage/10000-report.json).

At 10,000 hands, canonical records are 474,082,014 bytes unchanged; replicas fall from 217,052,420 to 1,440,222 bytes; checkpoints increase from 16,139,321 to 32,278,642 bytes because the prior verified rollback checkpoint is retained. Financial journal: 6,864,209 bytes / 10,230 events, unchanged. Session records: 536,823 bytes / 101 sessions, unchanged. A 799-byte pre-maintenance manifest is retained. Current manifest changes from 799 to812 bytes; other metadata from617 to1,182 bytes.

Canonical field subtotals include replay frames382,964,292 bytes, final views47,453,937, private policy metadata35,207,504 and provenance2,460,000. They are already inside the canonical total. Checkpoint hand indexes7,341,074, ledger5,044,150, resident hands2,578,656, statistics655,604, sessions519,057 and bot memory201 bytes explain the old checkpoint. Subtotals omit JSON punctuation; do not add them again to parent totals. No diagnostic artifacts were found inside this synthetic application save. Origin-wide browser usage can include separate diagnostics/test databases and native storage overhead.

Independent full replay, every canonical record family, each redacted hand export and the full financial state agreed before/after at all four sizes. The unchanged10k endpoint is wallet98,640,349 cents, table0, poker result−1,359,651 cents,10,000 hands,10,230 events and101 sessions. Manual adjustments remain distinct from poker P&L.

## Timing and risk boundaries

Matched Node24/Linux AMD EPYC9V74 reference single-sample recovery before/after (ms):100hands210.83/170.87;1k352.08/277.20;5k937.68/823.81;10k1,081.22/1,158.29. These are not browser percentiles and do not show a general recovery improvement. Explicit audited maintenance cost0.34/2,626.51/11,882.46/24,139.90ms; independent full-audit completion98.63/1,876.35/10,594.27/22,054.20ms. Fixture construction is excluded.

The historical10.07-second bot-preparation event remains **UNATTRIBUTED**, not fixed. [Risk assessment](tests/step5h-browser/OUTLIER_RISK.md) preserves the uncertain denominator and consequences. Controlled native-browser gameplay separates computation from intentional think-time, fixture generation and explicit archive maintenance. Long-task and frame-gap timestamps do not identify garbage collection or CPU cause. No forced device-speed or human calibration claim is made.

The first native10k attempt did not finish first-save fixture construction. A second streamed prebuilt baseline reached full-history loading (33,888.5ms;807,535,027-byte sampled heap), then stopped returning DOM reads during a second independent audit. Both incomplete receipts are preserved under [browser evidence](TEST_EVIDENCE/step5h/browser). Source review confirms that full displayed history and a second reconstructed archive could coexist; that observation alone does not attribute the timeout or historic bot stall.

## Reproduced memory duplication and repair

The controller now releases its materialized full-history cache before independent archive audit or replica maintenance, reusing only its exact previously verified compact state (or the existing verified compact-snapshot capability). Hidden history/replay/filter/statistics caches are invalidated before reconstruction. Original records are not removed and the full canonical audit still runs. Full-history adoption now also checks the entire non-hand header and the exact committed hand ID/hash index. Active tables, ownership loss and changed revisions remain fenced.

Matched fresh-process diagnostic-GC experiments prove the former full snapshot becomes unreachable before reconstruction. At10k hands, retained heap immediately before audit fell638.26→48.50 MB; with the audit result live1,236.41→642.56 MB; after audit646.71→52.86 MB. At1k, audit-return live heap128.57→74.69 MB. These are diagnostic reference measurements, not phone/browser latency or forced-GC production behavior. Exact ledger hashes and full audit receipts agree. [Memory evidence](tests/step5h-residency/README.md).

The repaired native10k combined path subsequently **PASSed**: verified gameplay ready1,973.3ms,120 resident bodies,503 production bot preparations and69 completed/cashed-out controller hands across2/6/10seat configurations. Bot preparation p50/p95/p99/max22.5/66.5/683.8/776.6ms. Maximum observed long task683ms; maximum frame interval1,016.6ms (includes scheduling, not a CPU-cause attribution). Explicit maintenance53,501.9ms; full-history load45,943.4ms; independent audit46,800.4ms. These deliberate operations are distinct from startup and normal bot preparation. The final sampled heap was101,670,641 bytes. The full audit verified10,069 hands and wallet98,641,307 cents; original10,000 hand hashes and financial commitments remained unchanged. Repeated preparation identities, engine accounting and single settlements were checked. [Full native receipt](TEST_EVIDENCE/step5h/browser/native-10000-repaired.json).

The browser is Linux cloud Chromium155, not an actual phone. Fresh document recovery excludes streamed fixture installation; browser/process caches and GC are not forced cold. Gameplay loops use real controller/engine/native persistence without UI think-time; exact compiled UI workflows are separate. Before-repair100/1k/5k samples respectively had39/109/106 preparations; p50=23.5/22.7/19.3ms,p95=77.1/56.4/66.4ms,p99=85.2/64.2/530.0ms,max=85.2/166.9/536.7ms. They are repeatable workload classes with production randomness, not matched action-by-action policy speed claims.

## Browser-reported origin usage

Actual readings use feature-detected `navigator.webkitTemporaryStorage.queryUsageAndQuota` because standard `navigator.storage.estimate` was unavailable in the HTTP preview. This deprecated Chromium API is read-only and origin-wide; it cannot attribute filesystem allocation to individual records/databases. No security-context bypass was used.

| Hands | Origin bytes before maintenance | Immediately after | Exact logical save bytes before / after |
|---:|---:|---:|---:|
|100|439,967,860|439,967,860|3,032,612 /3,032,612|
|1,000|472,035,465|471,049,087|69,361,766 /54,432,384|
|5,000|401,167,171|369,966,742|355,315,746 /263,087,222|
|10,000|565,045,653|626,577,034|714,676,224 /515,204,724|

The10k immediate origin reading **increased** despite the logical reduction. Later it read536,740,175 bytes after69 additional hands and audits, then525,205,710 after test-database cleanup. These origin-wide readings contain other preserved test databases and browser allocation/accounting effects; no precise per-database physical saving or causal allocation explanation is claimed. The21-byte logical difference from the reference reports is the current lease representation. Completed runs deleted only their own disposable test databases; cleanup of the two earlier unresponsive10k runs is unverified. No production database was opened.

## Candidate and external work

[Separate private candidate](https://ai-texas-hold-em-r1-test.stevemccutcheon89.chatgpt.site). Follow [candidate access](TEST_EVIDENCE/step5h/TESTING_ACCESS.md) and the [physical iPhone, VoiceOver and three-user checklist](tests/step5h-external/QUICK_START.md). Test data is isolated by a separate origin and per-run namespace. Production saves are not automatically read, imported or migrated. Existing V7 and privateV12 remain unchanged.

The new private Site deployment succeeded, but hosted owner gameplay is **BLOCKED / NOT VERIFIED**. Initial cloud sign-in was declined. Automatic approval review rejected later navigation because it redirected to Google authentication after that decline. No bypass, sign-in retry, access widening or invitation was performed. Owner-only access means independent participants need separately authorized access or an observed authorized session.

Physical iPhone Safari export: **AWAITING USER VERIFICATION**. Actual phone/desktop performance, VoiceOver, and three new users ×25 observed hands: **NOT_EXECUTED**. Device/browser/build, actual spoken output, misclicks, actions, saved Files exports and original outcomes must be recorded. The packet contains a neutral invitation draft, feedback form and75-hand observation sheet; none were sent or filled with invented results. V522 remains **BLOCKED pending the future GitHub connection**.

## Requirement accounting and release decision

All302 original IDs and86 deferred entries remain unchanged. Original status totals:221PASS,0FAIL,6BLOCKED,75NOT_EXECUTED. The237 R1-critical rows are a subset of original IDs, not237 additional invented requirements. Historical effective cash passes230 include explicitly split mixed criteria; they are not230 whole original PASSes or fresh candidate qualifications. V706 straddle and Z14 deferred favorites remain incomplete as whole original criteria.

Known mandatory concerns remain **U10,U11,U16,Z02,Z14,V518,V522,V707**. U10 needs real screen-reader evidence; U11/V518 declared physical-device performance and accessible interaction; U16/Z02 a complete historical project-write audit plus gated release/deployment evidence; Z14 the complete cash workflow/storage/performance conjunction; V522 actual hosted CI; V707 real new users. Additional current-candidate evidence mapping gaps are listed in the source-bound302-row qualification view, not misreported as runtime failures.

Migration and rollback regression uses actual frozen Version13 and V7-R readers; newer-save rollback is a controlled data procedure, not merely redeploying Version7. Quota/transaction interruption and multi-connection ownership tests preserve recoverable records. Guest local data is not guaranteed to survive user deletion or browser eviction, and guest saves do not automatically synchronize across devices.

No synthetic bot frequency is presented as measured human calibration, expert review, solver verification or real-world profitability. Tournament modes, run-it-twice, bomb pots, expanded personalities and all other86 deferred features are preserved. **Do not publish over Version7 while mandatory release evidence remains incomplete.**

## Final executed qualification and candidate identity

The exact candidate application source is `138cdcf325129c69f127d0e16bc94942abea752f`. Final [release-bounded receipt](TEST_EVIDENCE/step5h/release-bounded/manifest.json): **2,114/2,114 tests PASS,224files,0failed,0skipped**, plus typecheck, lint, specification, generated registry, independent paired reference and production build PASS. The full run includes PokerKit,20k accounting, bots, recovery, migration and rollback. HostedCI was not executed.

Previous failures remain: release-repaired had2,106passed cases but7fixture-script lint errors; release-qualified received a stop request after a stale generated dashboard, but its work continued to a FAIL receipt with changed inputs and1failed test; release-candidate had2,111/2,112passed with one20,184ms timeout. That unchanged case passed alone in10,648ms. The overlapping failed runs do not isolate4-versus8worker performance. The final clean run capped release file concurrency at4, retaining all cases and the20s timeout; the final full-run case passed in12,814ms. No test weakening, automatic retries or result rewriting occurred.

Final exact compiled browser checks: **22 actual UI hands**,11each at390/1280CSS pixels,58PASS workflow records per run. They cover2–10seats,stake/configuration controls,notes,manual adjustments,legal bets/raises,all-ins,settlement,top-up,cashout,history/replay/export/import/statistics and pending/flop/postpayout reloads. [Mobile](TEST_EVIDENCE/step5h/browser/final-compiled-390.json), [desktop](TEST_EVIDENCE/step5h/browser/final-compiled-1280.json). These are scripted cloud-browser users, not the required independent new users.

Final native IndexedDB safety: **8/8PASS**, including injected quota/abort, two independent connections and ownership fencing, once-only financial events and non-destructive missing-state handling. This is not a physical power-loss or browser-eviction guarantee. [Receipt](TEST_EVIDENCE/step5h/browser/final-native-transactions.json). The mounted1k History→Cashier audit/maintenance→History workflow alsoPASSed, confirming120resident bodies before storage work and exact financial/history agreement through UI actions. [Receipt](TEST_EVIDENCE/step5h/browser/mounted-history-maintenance.json).

[Fresh302-row qualification](tests/step5h-gates/current-repairedqualification/release-status.csv) verifies **124/237 original critical IDs**, with zero source/fixture/case/compiled-byte mismatches. **113 remain unqualified:8known concerns plus105additional evidence mapping reviews.** These are not113failed runtime tests. Original statuses remain221/0/6/75.

The separate owner-private testing Site is now **Site Version2**, packaging-source commit `905d6be74e810def2bd0b2a4b2b42e4c018c5486`, deployment `appgdep_6ae7fbad9d58819180bfcf8371959b96` **SUCCEEDED**. It serves the exact138cdcf compiled candidate in the isolated review wrapper. Earlier private-candidate Version1 remains in its version history. PublicV7 and original privateV12 were not deployed to or altered. Main source/evidence checkpoint is the Git commit accompanying this report; the final save receipt identifies its full SHA.

Next engineering/evidence tasks: review the remaining105current-candidate mappings, complete provider historical-write provenance, continue monitoring the unattributed long tail and large-archive display/audit costs, and run the declared device/reader/three-user checks on this exact private candidate. After the later GitHub connection, execute actual hosted CI. Publish only when all mandatory R1 gates pass.
