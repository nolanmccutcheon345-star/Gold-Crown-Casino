# Continued development without GitHub — Step5G

**NOT READY FOR R1.** The public Version 7 Site remains unchanged. Original saved Version 12 (`7ac2175ba3478102c521a149ce339f0fbc4d586b`) remains unpublished. This work saves a later source checkpoint without deploying the main Site. No GitHub connection was requested or required for development.

Project: `/workspace/sites/ai-texas-hold-em`. Public Site: https://ai-texas-hold-em.stevemccutcheon89.chatgpt.site . Full clean execution source: `fb559628b66ebd687fb2ef4b15ebd572c22afc91`. Later commits add evidence, frozen test packages and acceptance mappings; all 147 production inputs and all 3 built assets match that executed source in [current-build-verification.json](TEST_EVIDENCE/step5g/current-build-verification.json). The source commit containing this report and subsequent native save receipt identify the saved checkpoint; the execution-source SHA is deliberately separate.

## Implemented

- **Narrow memory fix:** `src/storage/packed-hand.ts` no longer registers temporary, immediately discarded write-validation nodes in its long-lived private provenance WeakSet. Descriptor, type, reference, depth and expansion checks still execute; nodes remain frozen. Public decoding always registers returned nodes. No caller-controlled bypass was added. This is the only production-source file changed from Version 12. Poker rules, financial authority, bot policies, data encoding and schema remain unchanged.
- **Reproducible profiling:** sustained natural-GC mode, separate restoration/audit/ordinary-action windows, CPU and allocation profiles, and the 20 slowest complete decision contexts. Profile serialization now follows preservation of the scalar execution receipt. Large profiles are losslessly segmented with full and per-part hashes, rather than losing the run receipt to an artifact-size failure.
- **Isolated testing:** checked packaging tool rejects production identity/origin, altered or extra files, symlinks and overwrite; verifies the exact compiled candidate and source receipt before copying it to the separately registered Site. Candidate navigation fixes keyboard focus after verification and provides explicit links to table controls and observations. Browser regression supports a strictly validated candidate-package path.
- **Evidence handling:** V522 is explicitly BLOCKED, original requirement wording unchanged. Current evidence is distinguished from historical acceptance status. A ready-to-share invitation, feedback form and 75-row observed-hand sheet accompany concise iPhone and VoiceOver instructions. No invitations were sent and no participant results are invented.

## Performance and memory findings

The historical **10.072-second preparation remains UNATTRIBUTED**. Its old evidence lacks the decision timestamp and complete contemporaneous phase/GC trace. New shorter peaks do not prove its cause or absence. Monitoring now retains full slow-decision context and CPU/GC clock anchors without exposing private diagnostics in normal play.

| Executed workload | Preparations / newly completed hands | p50 / p95 / p99 / max preparation, ms | Important boundary |
|---|---:|---:|---|
| Exact Version 12, initial1,000 saved hands, recovery stress | 12,011 /1,663 | 11.56 /49.68 /218.34 /291.80 |48 injected pending reloads and forced-GC samples; not uninterrupted play |
| Updated production code, initial10,000 saved hands, uninterrupted natural-GC profile | 1,002 /164 | 11.82 /54.89 /374.77 /470.19 |No forced GC or midplay reload;1ms CPU sampling and32KiB allocation sampling |

These are distinct workloads, **not a matched before/after speedup**. They execute actual production engine/controller/persistence against a disk request reference, not native browser IndexedDB. The second workload's fresh verified checkpoint startup was1,571.08ms; three fresh-controller recoveries had median1,283.76ms and maximum1,435.41ms. Explicit full-history loading took27,593.34ms and full independent audit27,013.85ms. These Node measurements do not establish phone readiness, frame responsiveness or INP.

The new 470.19ms peak contains persistence commit461.32ms, checkpoint preparation353.43ms, transaction104.18ms, reference JSON serialization81.08ms, policy0.36ms and natural GC overlap14.50ms. Spans are nested, not additive. CPU samples show canonical serialization, reference JSON serialization, array/string assembly, GC and freeze traversal as substantial costs. Policy computation is not the main cost of this particular peak. This attribution does not explain the old 10.072-second observation.

The matched three-pair memory experiment showed write-only retained WeakSet capacity **131,112→104 bytes**, with approximately133KB lower post-GC heap. Packing plus legitimate public decoding retained **4,194,344 bytes on both sides**. Both results are preserved: the fix removes avoidable temporary registration, but does not solve the previously reported 128MiB capacity or overall archive memory. Encoded bytes, hashes and all 107,124 unique packed nodes were identical. No general latency or storage reduction is claimed.

| Representative fresh-save population | Total serialized store | What was independently checked |
|---:|---:|---|
|100 hands |3,032,591B |Every canonical/packed pair, compact accounting, full canonical audit |
|1,000 hands |69,361,745B |Same checks |
|10,000 hands |714,676,203B |All10,000 pairs,10,230 financial events,101 sessions, current full audit |

The 10k store includes474,082,014B canonical hands,217,052,420B packed replicas and16,139,321B checkpoint. All records remain intact. Compact and full replay both return wallet98,640,349 cents and table0. The 10k diagnostic's post-GC heap was19.34MB after fixture scope release,41.85MB at verified compact readiness and633.96MB with full history/audit held. Its2.16–2.17GB RSS is fixture/allocator high-water, not live JavaScript heap. These isolated first-save representations are not 10,000 observed UI hands. Physical browser quotas/eviction and sustained archive browsing remain validation work. Guest browser deletion or eviction can lose local saves; public hand-history export is not a bankroll backup.

Across the two successful stress runs plus a small harness smoke: **3 complete scenarios,13,023 preparations and1,832 new hands**, with independent financial/statistical agreement. These are neither unit-test nor acceptance-requirement counts. [Profiling report and raw artifacts](tests/step5g-performance/README.md).

## Actual regression results

| Execution | Result |
|---|---|
| Clean full release suite at `fb559628` | **2,044/2,044 PASS**,213 files,0 failures,0 skips |
| Typecheck, lint, build, original registry, CI-contract checks | PASS |
| Independent PokerKit/accounting/reference checks | PASS; paired-reference repeat is separately recorded, not added to2,044 |
| Exact frozen Version 12 browser runs at390/1280 CSS px |22 complete UI hands,116 workflow records PASS |
| Actual keyboard hand and two actual tabs on frozen Version 12 |1 further hand; two explicit ownership transfers; losing tab read-only;1 settlement and1 cashout; identical final ledger hashes |
| Updated compiled candidate at390/1280 CSS px |22 complete UI hands,116 workflow records PASS |
| Isolated-site packaging boundary tests |12/12 PASS; separate Node cases |
| Focused codec / independent review runs |120/120 and439/439 PASS; overlapping coverage, not added to full-suite count |

The full suite includes poker rules, rake/refunds/side pots, chip conservation, bot privacy/idempotency, accounting, statistics, corruption, interrupted writes, migration/rollback, policy-version compatibility, recovery and layout regressions. These actual local results are not hosted CI. All execution logs and hashes are in [release-final](TEST_EVIDENCE/step5g/release-final/manifest.json).

The updated browser runs exercised every seating count2–10, custom stakes, exact raises, manual bankroll adjustment, top-ups, safe session exits, history export/reimport, replay privacy, statistics and filters. Each run reloaded preflop with a pending bot, on the flop, after payout and after history; each completed 11 hands with exactly 11 settlements and 11 cashouts. Mobile final wallet was1,203,647 cents, table0, poker profit3,647 cents; desktop wallet1,196,070 cents, table0, poker profit−3,930 cents. Both reconcile to the manually adjusted 1,200,000-cent base, without counting the adjustment as poker winnings. [Updated build browser receipts](TEST_EVIDENCE/step5g/browser/hardened-summary.json); [frozen Version 12 browser receipts](TEST_EVIDENCE/step5g/browser/version12-summary.json).

Total new actual browser hands this turn: **45** (22 frozen Version 12 +1 keyboard +22 updated build), not 45 independent users or device tests. The public Version 7 guest site was inspected read-only; another tab's ownership was respected, no production cashout or migration was performed. Native browser rollback was not rerun in these pages; the full automated rollback suite passed and prior native evidence remains preserved. No actual screen reader, iPhone, human-calibration or expert-strategy result is claimed.

Failures are retained. The first integrated run passed 2,040 tests but failed lint on a missing Node URL import in a new packaging test; the import was fixed and the complete clean 2,044-test run passed. The first large natural-GC profile reached 4,008 preparations but failed allocation-artifact capture; its surviving trace is preserved as FAIL, and the repaired 1,002-preparation complete run is separate. Neither failed attempt was retrospectively relabeled PASS.

## Separate Version 12 testing Site

**Available:** https://ai-texas-hold-em-v12-test.stevemccutcheon89.chatgpt.site . This is a separate owner-private project, its own HTTPS origin, and separate guest database namespace. Native deployment succeeded for its own Version 1, source `fd52c644da201747d043ff42943c97d48816f727`. It serves the frozen Version 12 application's exact verified JS/CSS; the wrapper validates hashes before opening it. The main Site's Version 12 has no deployment ID and Version 7 remains public. This does not publish the main candidate or approve R1.

The cloud browser reached the platform owner sign-in screen; **authenticated hosted gameplay remains BLOCKED in that browser**. The owner can open the link using the authorized account. Independent testers will need explicit viewer access; none has been granted or invited this turn. Do not share credentials. Later source hardening is available as a separate local package and is not silently substituted into the frozen Version 12 Site. Device observations must record the exact candidate version tested.

[Testing access and provenance](TEST_EVIDENCE/step5g/TESTING_ACCESS.md), [short iPhone/VoiceOver guide](tests/step5f-external/QUICK_START.md), [three-user protocol](tests/step5f-external/NEW_USER_STUDY.md), [draft invitation](tests/step5f-external/INVITATION.md), [feedback form](tests/step5f-external/FEEDBACK_FORM.md), [75 observed-hand rows](tests/step5f-external/hand-observation-form.csv).

Physical iPhone export remains **AWAITING USER VERIFICATION**: save a real history file to Files, reopen/import it for study, confirm redaction and unchanged wallet/results, and return device details plus the separate observation file. Actual VoiceOver requires recorded spoken output and task completion. V707 requires three genuinely new people, each playing 25 observed hands; automated hands cannot substitute.

## Remaining release requirements

The sole 302-ID status register retains **221 PASS /0 FAIL /6 BLOCKED /75 NOT_EXECUTED**. These are accumulated original statuses, not claims that 221 criteria were freshly qualified on this candidate. The historical 229/237 cash-component qualification belongs to its original source and is not silently transferred. The fresh review qualifies **98/237 R1-critical original IDs** against the actual passing receipt, with zero verification errors. **139 remain unqualified: eight known open gates plus131 further mapping/review tasks**, not139 demonstrated runtime defects. [Current302-ID candidate release view](TEST_EVIDENCE/step5g/qualification-expanded/release-status.json) and [review summary](TEST_EVIDENCE/step5g/qualification-expanded/README.md) keep absent mappings unqualified rather than presumed passes. V706's whole original criterion remains NOT_EXECUTED although its cash portion passes; straddles remain deferred.

The eight known mandatory open gates are shown below with their unchanged original criterion. Available automated and browser evidence supports parts of them, but none is promoted by a partial check.

| ID | Original criterion | Current whole status / remaining dependency |
|---|---|---|
|U10|Core actions operable and properly announced without animation-only meaning|NOT_EXECUTED|
|U11|Measure decision compute P50/P95, 10-seat frame responsiveness and input-to-confirm latency on specified phone/desktop|NOT_EXECUTED|
|U16|Verified unique project ID + site URL, deployment build, original sites unchanged by all write calls|NOT_EXECUTED|
|Z02|New project/site identity proven and old project unchanged; signed-off deploy SHA and actual browser smoke recorded.|NOT_EXECUTED|
|Z14|No compulsory training modal; hand replay and notes respect private-card disclosure; uninterrupted play, touch/keyboard support, bounded storage, no performance regression.|NOT_EXECUTED|
|V518|Measure p50/p95 bot response, render time, memory and action error rates on declared reference devices during repeated 2/6/10-seat play; check keyboard/screen reader/color-independent card labels.|NOT_EXECUTED|
|V522|Every required critical test has runnable command/fixture plus build+seed+evidence; CI blocks errors; canonical V5 document is authority; V4 archive cannot override it.|BLOCKED|
|V707|Three new test users on specified mobile/desktop view must locate minraise, raise-to total and call/additional amount, play 25 hands; record each actual misclick and observed ambiguity. No fictional completion.|NOT_EXECUTED|


**Next engineering work:** continue source-bound review of the remaining original criteria; measure bounded archive materialization and native-browser storage pressure on the compiled candidate before choosing another optimization; retain slow-decision trace capture for the unexplained tail. U16/Z02 still need complete historical project-write provenance and final signed-off deployment/smoke, not a claim inferred from current identity alone. Z14 remains open for its complete conjunction, including bounded storage and performance. The private testing Site enables external evidence without disturbing Version 7.

Hosted CI V522 remains **BLOCKED pending the user's future GitHub connection**. No new GitHub approval request is made. Actual phone/desktop device measurements, actual screen-reader execution and three-user testing remain outstanding. All 302 original requirement IDs/text and all 86 deferred features remain preserved, including tournaments, run-it-twice, bomb pots, additional variants and future personalities. The authoritative engine and synthetic-policy limitations are unchanged. **Do not deploy the main candidate until mandatory gates and complete current-candidate evidence pass.**
