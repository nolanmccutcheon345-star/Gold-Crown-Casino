# Step 5L — completed recovery and release qualification

**NOT READY FOR R1.** Production Version 7, the public R1 test revision 6 and the original private Version 12 environment were not deployed, replaced or given different access settings during this work.

## Source recovery and durable handoff

The existing main Site source was recovered at Version 15, b4dfd689ecd2216d4d84fecc99ac61f60ba8fcde. The R1 packaging repository was recovered at 566f3b11032841c492e6e148bb9a1139e74247b7. The original Git object 3ecea1c2b71c8e8b9963547da676171f91f21716 was **not** recovered. Unfinished checkpoint 1805380 was also **not** found; no missing commit is manufactured.

The actual application was reconstructed and independently verified byte-for-byte against the surviving candidate execution receipt: 142/142 production source files and all three fresh compiled assets match the hosted candidate. Of 1,599 receipt paths, 1,594 already matched the recovered base. The production delta was the exact Table settings accessibility label. Recovery commit c9a4c11fe32c18cecda68eb2a0bfcc97b09b8879 has a new, honest identity. A fresh build from an independently restored backup also matched.

The unavailable original QA files are tests/step5k-accessibility/README.md, tests/step5k-hosted/README.md and tests/step5k-hosted/build-qa.mjs. The changed dependency-status test was reconstructed as a new test revision, with its failed stale assertion and corrected execution retained. Compiled QA artifacts are distinguished from original source. The available tools and source histories do not establish permanent server deletion of the missing objects.

Initial independent backup: a verified complete Version 15 Git bundle in four parts, candidate recovery ZIP, checksums and restoration instructions. These are saved as independently downloadable files. The final handoff adds an incremental Git bundle containing this step's source, exact tests, full lossless resource archives/traces, acceptance records and browser evidence. The handoff receipt identifies the final source commit, saved unpublished Site version and backup hashes. It is not a backup of real users' browser bankrolls.

Evidence: tests/step5l-recovery-audit/, TEST_EVIDENCE/step5l/independent-backup-restore.json, TEST_EVIDENCE/step5l/final-checks/build-agreement.json and backup-receipts.json.

## Completed fresh resource workload

The interrupted original run was not passed or resumed by inventing a committed count. Its surviving 1,754 physical records lack the original live index and remain explicitly unqualified forensic evidence. A separately restored, hash-verified harness started a new empty account.

- 10,000 newly played hands, 91,573 actions, 74,117 bot preparations and 250 sessions completed.
- Independent integer replay verified all 10,000 canonical hands and 10,508 financial events. No duplicate settlement or cashout; final wallet 98,791,469 cents equals manual funding 100,000,000 minus poker result 1,208,531, with table balance zero.
- 74 pending-action reload/stale-commit checks passed. Maximum one controller timer, zero after close. Redundant storage stayed within 120 packed copies, two checkpoint generations and the enforced journal/cache limits.
- Preparation p50/p95/p99/maximum: **12.08 / 49.41 / 337.89 / 783.55 ms**. No preparation exceeded one second in this run. This does not explain or fix the historical 10.072-second event.
- Nine final verification groups, independent archive verification, corruption controls and lossless artifact restoration passed. Complete evidence is committed in 94af899ebb8098ab05c49f4f2afb379bf8c26cf8.

| Completed hands | Logical payload MB | Post-GC heap MB | Warm controller recovery |
|---:|---:|---:|---:|
| 100 | 24.53 | 31.88 | 0.517 s |
| 1,000 | 74.24 | 36.92 | 0.772 s |
| 5,000 | 299.67 | 83.02 | 1.217 s |
| 10,000, after final cashout | 586.51 | 110.23 | 1.836 s |

Decimal MB are used. Logical payload contains 520.44 MB canonical hands, 42.44 MB checkpoints, 12.64 MB incremental journal, 7.03 MB canonical ledger, 2.91 MB packed copies and 1.04 MB sessions, plus small heads/manifests. This is not native browser origin usage. It must not be compared directly with the prior 714.7 MB origin measurement as an optimization result.

The Node reference adapter uses actual production engine/controller/storage code but is not native IndexedDB or a physical device. Recovery constructs a fresh controller in a warm process. Concurrent regression load, diagnostic arrays, explicit GC and reference-adapter allocations are disclosed. Full history loading took 28.14 seconds and the explicit canonical audit 25.58 seconds. Bulk processing reached a coarse 963.53 MB heap / 1.71 GB RSS, including test overhead. This remains a limitation; no claim of small-device suitability is made from these figures.

Full report: tests/step5l-resource/FINAL_REPORT.md. Source/bundle identities, per-seat samples, intermediate sizes, nested timing traces and retained evidence parts are included there.

## Completed hosted endurance, export and accounting

The unchanged HTTPS candidate ran as a guest in Linux Chrome 155, 1363 × 936 CSS pixels. One initial manual hand and a 104-hand endurance session completed. Independent exports prove **100 ten-seat endurance hands**, four nine-seat hands (57–60), and the separate initial ten-seat hand. The four reduced-seat hands were not counted as ten-player coverage.

All six original redacted export batches passed independent Python checks: 105 unique hands, 2,014 replay frames, 2,645 events, 1,909 action decisions and 13 refund hands. PokerKit 0.7.7 independently agreed on all 93 contested showdown winner sets; 12 pots were uncontested. The same hands are not counted again as additional tests or hands.

| Financial observation | Result |
|---|---:|
| Initial virtual bankroll | $10,000.00 |
| Initial one-hand session | +$37.92 |
| Endurance session, 104 hands | −$650.93 |
| Total poker result | −$613.01 |
| Final cashout | $168.36 |
| Wallet after cashout and reload | **$9,386.99** |
| Table balance after cashout | $0 |

Reloads after 20, 40, 60 and 80 hands preserved visible bankroll, session results and every stack exactly. The final cashout remained unchanged after reload. The hosted full-history audit independently reported 105 verified hands and the same bankroll at saved revision 5781. Public exports do not expose financial-ledger IDs; duplicate-transfer identity coverage comes from separate ledger/persistence tests and observed cashout behavior.

Complete-hand example: in hand 104, Casey posts $1 and Taylor $2; Hero calls $2, the other players fold, and Taylor checks. Hero and Taylor check every later street. Board 3♠ A♠ 2♦ 8♣ 6♦: Taylor's 6♣2♥ wins the $5 pot over Hero's 8♠T♣. Hero loses $2 and ends with $168.36; Taylor gains $3 net. Rake is zero for this workload; rake regressions are separate.

A repeated refill attempt without an observed save acknowledgment left one seat empty. A focused controller test and acknowledged UI reruns verified repeated identical targets, exact transfers and queued reload. No value-reuse engine defect was established, so no speculative production patch was made. The QA sequence now verifies the queue acknowledgment and counts actual occupied seats.

Browser file-download transport failed. The original export text was preserved through the ordinary View/copy JSON fallback; successful download to Files is **not** claimed. In a separate empty test account, 16 hands imported through study preview/selection/confirmation. That account retained zero canonical played hands, $10,000 bankroll, $0 seated and $0 poker profit. Multi-tab ownership correctly refused the second tab until the finished test tab closed.

Evidence: TEST_EVIDENCE/step5l/browser/ and tests/step5l-regression/HOSTED_EXPORT_REVIEW.md.

## Performance conclusion and remaining limitations

The historical maximum was 10,072.242 ms among 69,055 preparations on historical source 6807744037d2de0ee2c298a9b097a7a4e09c51da. Its individual sample, CPU/GC trace and context are unavailable. It remains **UNATTRIBUTED**, not fixed. No recurrence above one second in the new 74,117-sample run is useful evidence, not proof that recurrence is impossible.

Five separate hosted gameplay phases retained all per-operation preparation summary samples, while explicitly reporting capped raw timing/event traces. The final phase recorded 322 preparations: p50 111.3 ms, p95 181.5 ms, p99 650.8 ms, maximum 704.4 ms. These are phase statistics, not fabricated aggregate percentiles for all hands.

Cloud-browser frame-based confirmation measurements include multi-second readings. A separate eight-navigation control reproduced approximately one-second frame gaps without bot computation. Event handlers were much shorter, but supported observations cannot isolate the presentation/platform cause. No INP or no-performance-regression PASS is inferred. Z14 remains unqualified.

## Regression and acceptance

Fresh full release execution passed **2,114/2,114 automated tests in 224 files**, zero failed or skipped, plus 29 runner-contract tests. That execution source is 791cb3ed52294c725d79eeb39ccb51161c1317ea; its runtime/build bytes match the hosted candidate. Independent replay covered 7,136 emitted regression hand records, R21 ran 3,072 probe hands, and V620 used 577 actual observer cases. These subsets and supporting simulations are not added to the 2,114 count or substituted for original acceptance requirements.

Additional executed evidence includes the completed resource run, the independent hosted checks, one repeated-target regression, public-export validator positive/corruption controls and acceptance-evidence verification tests. Final typecheck, complete lint, production build, specification integrity and Git integrity passed, with commands and exit codes retained in TEST_EVIDENCE/step5l/final-checks/.

The reconciled candidate qualifies **229/237 R1 checks**. All **302 original IDs and wording** remain intact: **221 PASS / 0 FAIL / 6 BLOCKED / 75 NOT_EXECUTED** in the whole-criterion column. Cash-scope candidate qualification is a separate column; mixed requirements such as V706 and Z14 do not become whole-criterion PASS when deferred parts remain unexecuted. All **86 deferred features** remain preserved, including tournaments, straddles, run-it-twice, bomb pots, variants and expanded personalities.

| Mandatory original ID | Remaining requirement |
|---|---|
| U10 | Real screen-reader interaction and actual spoken announcements |
| U11 | Declared physical-device compute/frame/input measurements |
| U16 | Complete historical provider project-write/nonmutation audit |
| Z02 | Remaining historical project provenance/nonmutation proof |
| Z14 | Defensible current presentation/performance qualification |
| V518 | Physical reference-device measurements and reader checks |
| V522 | Actual hosted CI; BLOCKED pending the user's later GitHub connection |
| V707 | Three independent new users, 25 observed hands each |

U12's fresh workload now qualifies. Original statuses were not rewritten to obtain release approval. Current release-gate logic actually refuses publication. The complete ID-preserving review and evidence are in ACCEPTANCE_STATUS.csv, R1_DASHBOARD.md and STEP5L_GATE_REVIEW.md.

## External testing and next actions

Use the public R1 test Site at https://ai-texas-hold-em-r1-test.stevemccutcheon89.chatgpt.site/ and confirm application source 3ecea1c2b71c8e8b9963547da676171f91f21716, package 566f3b11032841c492e6e148bb9a1139e74247b7. Production Version 7 and private Version 12 are not the candidate under test.

1. On a physical iPhone in Safari, record model/iOS/browser/build. Exercise 2/6/9/10 seats, legal raises, complete hands, cashout, reload and export to Files. Open the saved JSON and test study-only import. Record actual results; physical export remains AWAITING USER VERIFICATION.
2. With actual VoiceOver, operate betting, cashier, navigation, history and dialogs. Record the words spoken, focus changes and errors. DOM labels alone do not satisfy this check.
3. Recruit three people new to the app. Each independently sets up a table, locates call amount/minimum raise/raise-to total, plays 25 observed hands, cashes out and opens history. Record every misclick, ambiguity and assistance. Do not substitute simulations or coached staff repetitions.
4. Obtain missing provider write-audit evidence and investigate current presentation timings with suitable instrumentation. Keep hosted CI explicitly blocked until the future connection; no repeated GitHub request is required.

Exact original criteria, concise instructions, an unsent invitation and blank device/reader/participant/75-hand issue forms are in tests/step5l-acceptance/external/. No physical device, screen-reader, expert assessment, human calibration or new-user result was invented. No deployment or access change is authorized by this report.
