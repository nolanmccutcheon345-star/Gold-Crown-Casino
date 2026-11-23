# Step 5N final engineering and release evidence

**R1 NOT READY — eight mandatory gates remain.** The work below is completed engineering and executed evidence, not an approval to replace production Version 7. All 302 original criteria and 86 deferred features remain intact. Final development commit and saved version are recorded in the independent STEP5N_HANDOFF.json delivered with the backup; this report is included in that commit.

## Source and deployment identities

- Development started from saved unpublished Version 17, `831e9a67658766ca8bcec02fbc0a82a0eb27c4da`. This step changes CI, executable evidence checks, documentation and test-site packaging metadata; it does not change application `src/`.
- Public R1 test: https://ai-texas-hold-em-r1-test.stevemccutcheon89.chatgpt.site/ . Application identity remains `3ecea1c2b71c8e8b9963547da676171f91f21716`.
- Test-site package is now `2ab7ff9dbedcfcdcb712c6b01e423133426474b8`, saved/deployed test revision 7, deployment `appgdep_6ae95ba3be3081918a62e3bdfd263ddb`. This is a separate project's revision number, not a production upgrade.
- Previous test revision 6/package `566f3b11032841c492e6e148bb9a1139e74247b7` is retained as rollback. Only the stale responsive source label and complete package integrity inventory changed. Four stale diagnostic hashes and five omitted diagnostic files were traced to the original packaging update; their payloads were not changed by this repair.
- Production Version 7 remains `a0bfc0950771a6dc1b786e00c13be7f3485b8dcb`, deployment `appgdep_6ae6a07f5f488191b00077a585fd5d8a`. Private original Version 12 environment remains package `fd52c644da201747d043ff42943c97d48816f727`, deployment `appgdep_6ae7dc0f58788191a5769347fdf68b3a`. No access changes occurred.

Compiled SHA-256 identities are unchanged:

| Asset | SHA-256 |
|---|---|
| JavaScript index-DPmGgl-n.js | b74c56775dd4f68c4c4e194f49618a3096212b23839b379826a2d3089cdd1709 |
| CSS index-D_NKboRv.css | db55bcf3b24cc9ae81d3b39815c2950af353eb47cf5898ba1c73598b3f9d5a4e |
| Application index.html | aec2ba7fd5b3dce4722db23c325722c2afcf138dc7cb6e583b1dc46c2b4f1368 |

Actual original Git objects `3ecea1c2…` and unfinished `1805380` remain unavailable. Recovered source/build equivalence is independently supported for 142 production files and all three assets; a matching reconstruction is not a recovered historical commit. See STEP5L_REPORT.md and tests/step5n-regression/evidence/runtime-agreement.json.

## Implemented and executed

| Work | Actual result and evidence |
|---|---|
| Full release regression at exact base 831e9a | **2,115/2,115 PASS**, 225 files, zero failures/skips; typecheck, lint, build, specification/registry, eight included oracle cases and paired-reference check passed. Existing 20,000-hand accounting batch enabled. tests/step5n-regression/ |
| Independent financial replay | **7,136 emitted hands / 118,246 events** reconciled; six corruption controls rejected. These review the generated records; they are not additional played hands. |
| Bounded critical runner at clean CI implementation 5c5dfba | **2,105/2,105 PASS**, 219 files, no failures/skips, typecheck/lint/build and source-preflight passed; exact same application hashes. This overlaps the full suite, so counts are not summed. tests/step5n-ci/evidence/critical-execution.json |
| CI engineering | SHA-pinned official Actions, readonly token, 2-worker ordinary/oracle lanes, same-commit compiled browser artifacts, 26 authored browser cases covering 2–10 seats and keyboard journey, separately dispatched 10,000-hand resource lane. **Hosted execution NOT_EXECUTED.** |
| Workflow/runner contracts | 49 PASS locally; initial lint defects fixed and preserved. The authored 26 Playwright cases were enumerated, not executed. |
| Public HTTPS gameplay before packaging correction | Seven complete hands: 2 heads-up, 2 six-seat, 3 ten-seat. Independent 103-frame/143-event/96-action review passed; PokerKit agreed on six contested pots, one uncontested. tests/step5n-browser-review/ |
| Reload and accounting | Exact paused preflop state restored and hand completed; seven-hand archive audit passed at saved revision344. Wallet **$9,906.66**, table **$0**, poker **−$93.34**, unchanged after reload. Public redacted history retained. |
| Package correction | Reproduced identity/inventory defects; original guard 2 PASS/2 FAIL, repaired 4 PASS/0 FAIL. All asset and complete payload hashes verified. tests/step5n-browser/evidence/package-repair/ |
| Postdeployment HTTPS smoke | Correct source label and asset verification; guest ten-seat game completed, legitimate fold/end/cashout; wallet restored to $10,000/table0/P&L0. Keyboard Enter activation tested. This extra hand is separate from the seven-hand independent export. |
| Responsive layout | Ten seats at 320/375/390/430/768/1280px requested frame widths; no pairwise seat-box overlaps, no seats outside table width, no document overflow, legal call enabled. Desktop scrollbars reduced each content width by15px. Actual 390px screenshot retained. No physical-device claim. |
| Acceptance integration | Ten evidence-accounting checks and original12 registry/dependency checks pass; immutable302/86 validation passes; release refuses all eight missing gates. Generated dashboard initially drifted because a newly present evidence path became linkable; regenerated without status changes. |

Local browser execution used only the supported interactive Chrome155 HTTPS session. Seven-hand export came from the ordinary copy-JSON fallback; this does not claim native download-to-Files. The extra width smoke is not a real screen-reader study or full sequential-Tab test. Prior engine, rake, all-in, side-pot, compatibility, recovery and rollback suites remain enabled; the seven-hand sample itself used zero rake. Package changes cannot invalidate the unchanged engine hash equivalence, but no result is falsely assigned to another source without that relationship.

## Concrete completed-hand example after package deployment

Ten players started $200 each. Alex posted $1; Morgan $2. Jordan, Riley and Casey folded. Taylor raised to $4.88. Drew, Quinn, Sam, Hero, Alex and Morgan folded. The engine returned Taylor $2.88 uncalled and awarded the $5 contestable pot. End stacks: Taylor$203, Alex$199, Morgan$198, other seven$200; total remains$2,000. Hero result$0. New Session then Cash out$200 & configure new session returned Hero's $200 to the $9,800 wallet, preserving the hand and producing wallet$10,000/table0/P&L0. Actual rendered observations are in tests/step5n-browser/evidence/step5n-width-hand-settled.txt and step5n-width-cashout.txt.

## Performance findings and limits

Six disjoint retained phases provide66 bot preparations. Phase p50/p95/max milliseconds: HU119.6/179.3/179.3; six-seat110.0/175.1/175.1 and149.4/187.0/187.0; ten-seat99.3/306.8/306.8 and130.3/222.9/222.9; resumed ten-seat127.9/196.4/196.4. Independent raw-trace recalculation agrees. An overlapping capture and two unretained observation files are explicitly excluded.

Maximum preparation306.8ms, render operation84.1ms, in-phase long task137ms. Input-to-DOM-confirmation proxy reached3,041.7ms; it is not INP, physical paint, durable commit latency or an attributed bot-compute stall. Two retained warm-cache empty-account reloads reached visible saved UI at106.5/475.5ms; persistence load42.0/15.5ms. Coarse small-run heap reached32.23MB without forcedGC. These measurements cannot certify cold-cache/native large-history recovery or physical-device memory.

The previously completed10,000-hand reference workload remains valid preserved evidence, **not rerun during5N**:74,117 preparations, p50/p95/p99/max12.08/49.41/337.89/783.55ms;10,508 financial events reconciled; warm-controller recovery1.836s; logical payload586.51MB and post-GC heap110.23MB. Bulk history loading/audit took28.14/25.58s with coarse963.53MB heap/1.71GB RSS including fixture overhead. Logical payload is not browser origin usage. These limits remain material for low-memory devices.

The historical10.072-second outlier remains **unattributed**, neither reproduced nor proven fixed. The recent sample contains no comparable event but is not evidence of its impossibility. Current instrumentation records phase, policy, persistence, render and long-task timings; pending-action reload recovered safely. Monitoring, exact trace preservation and safe recovery reduce diagnosability/impact risk, not statistical uncertainty. **Z14 remains unqualified**; no speculative optimization or skipped integrity check was introduced.

## GitHub and security boundary

Actual connected account: **nolanmccutcheon345-star**, installation155311437 with repository selection all. Repository lookup returned404, which alone does not distinguish absence from inaccessible permissions. Available connector operations cannot create a repository or dispatch Actions; no local GitHub CLI/token exists. The supported creation page redirects to sign-in. Automatic approval review rejected authentication, citing the earlier GitHub deferral and not accepting the newer attachment as current sign-in authorization. No credentials were collected, no repository created, no hosted run executed, no GitHub fresh clone claimed.

The smallest next action is explicit current approval to sign into GitHub and create private `nolanmccutcheon345-star/ai-texas-hold-em`, followed by the supported secure authentication flow. Never provide passwords or tokens in chat. After authorization: audit compressed diagnostics/import dependency closure, create private repo, import verified source and required actual historical objects/fixtures, fresh clone/install/build, execute Actions and preserve real run/artifact URLs. Local green tests are not V522.

Tracked-file screening covered8,640files/2.953GBlogical bytes and found no selected obvious credential patterns;13 scanner controls passed. This is not an absence-of-secrets proof. Compressed diagnostic internals and the complete historical Git database remain **not cleared for blind external import**. Existing full independent backups preserve them. Required rollback/provenance tests depend on authentic historical objects; removing all evidence or creating an unrelated orphan import would break them. No real user guest bankroll was copied; all retained play records here are synthetic virtual-money test data.

## Exact release status

R1 remains **229/237 qualified**, with eight unresolved mandatory reviews. Original302 whole-criterion statuses: **221 PASS /0 FAIL /6 BLOCKED /75 NOT_EXECUTED**. The237 original release-critical rows themselves contain221PASS/0FAIL/1BLOCKED/15NOT_EXECUTED; separate mixed cash-component evidence and exact-candidate qualification account for the229 effective result. These are distinct status bases, not added automated-test counts. V706's cash portion remains qualified while its complete straddle criterion remains NOT_EXECUTED. All86future entries remain unchanged.

| Gate | Status | Smallest remaining evidence/action |
|---|---|---|
| U10 | BLOCKED | Actual VoiceOver/NVDA spoken/focus observations and completed hand/cashier/history workflow. |
| U11 | BLOCKED | Attribute the owner's reported iPhone PASS to device/OS/browser/candidate/checks; obtain missing physical decision/frame/input measurements. |
| U16 | BLOCKED | Complete provider historical project-mutation audit or equivalent verifiable nonmutation proof with completeness bounds. |
| Z02 | BLOCKED | Same historical old-project nonmutation proof plus final signed release record; source/build/browser portions are evidenced. |
| Z14 | BLOCKED | Complete browser/no-regression qualification, including large-history/device resource limits and unexplained rare-stall risk. |
| V518 | BLOCKED | Declared physical2/6/10-seat response/render/memory/action-error measurements and actual screen-reader checks. |
| V522 | BLOCKED | Accepted current GitHub authentication/repository creation and actual successful hosted Actions with exact source/artifact evidence. |
| V707 | BLOCKED | Three genuine new users,25 observed hands each, locating minraise/raise-to/call amounts, logging every misclick/ambiguity. |

Exact original text and evidence boundaries appear in STEP5N_GATE_REVIEW.md; no criterion was rewritten. Owner iPhone Safari **PASS_REPORTED** is recorded as genuine evidence with unknown details, not discarded or expanded into unperformed VoiceOver/export/performance checks. No independent users have participated in this step. tests/step5n-acceptance/external contains ready-to-share invitation, exact-candidate protocol and blank forms. Confirm existing device details first; repeat only missing tests.

## Final restore verification correction

The first independent restore build passed, but full lint caught three missing explicit Node URL imports in the copied package-evidence checker. Added the Node URL import in the development evidence copy, retained the initial failure, and reran lint. The public package test had already executed successfully in Node; application bytes and published packaging payloads were unaffected. This is an integration defect repaired before final handoff, not a silently discarded failure.

## Durable handoff and rollback

The final source is saved without publishing to the production Site. Independently downloadable incremental Git bundle, corrected test-package bundle, report, checksums, external kit and restore receipt supplement the previously verified full backups. Restore the existing complete backup through831e9a, verify/fetch the new Step5N bundle into that separate repository, check out its recorded commit, then run typecheck/lint/build and compare hashes. Do not restore over a user's browser save. The handoff receipt records actual verification and identities; no fresh GitHub clone is implied.

For this package-only test deployment rollback, redeploy saved test revision6 from STEP5N_ROLLBACK.json. No schema changed; do not reset guest data. Actual application upgrade/rollback tests remain preserved in the full regression and original V7-R procedures. Production deployment requires all mandatory gates and separate explicit final authorization. **Do not deploy R1.**
