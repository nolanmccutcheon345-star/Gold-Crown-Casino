# Step 5E browser verification

These are authored test controls, not browser PASS evidence. Root executes the
browser through the permitted CUA surface and saves the full returned JSON.
All pages identify themselves as developer diagnostics, synthetic fixtures,
NON-TRAINING and isolated QA; they are not an ordinary Live Table/Study feature.

## Preparation and source binding

Run `node tests/step5e-browser/build-runtimes.mjs all` after candidate production
inputs are frozen. Baseline is actual saved V10 `f5692f81514c5a4049a93c9bc22ca206f48e7c9c`.
Both runtime manifests include every bundled production source hash and emitted
JS/CSS hashes. Candidate dirty source is explicitly recorded. The recovery page
verifies each emitted byte hash before importing a typed Blob. This is a bundle
of production modules with QA exports, not a claim to be the `dist` entry point.

For actual compiled workflows, run
`node tests/step5e-browser/prepare-compiled.mjs TEST_EVIDENCE/<run>/manifest.json`.
It requires an executed successful build receipt and copies the exact verified
`dist` bytes. No production test injection is added. The compiled frame only
remaps the default database name to the new isolated QA name; all game/cashier
mutations use the production UI. QA independently reads canonical saved records.

## Recovery matrix

Open `/tests/browser/step5e-recovery.html` or its top-level run link. Run all sizes
0, 100, 500, 1,000, 5,000 and 10,000 for baseline and candidate. Run `normal` and
`conversion` separately. Run closed and paused pending-bot cases; do not infer a
pending result from a closed-session run. The original Step5D compressed fixtures
are streamed without changing canonical bytes, financial IDs or record ordering.

Normal mode first loads the candidate/baseline to complete its automatic storage
installation. It records this preparation separately, closes connections, saves
a bounded hashed scalar receipt, and uses real `location.replace`. Conversion
mode makes the same fresh-document transition without candidate preloading.
Pending mode first prepares a genuine committed decision through frozen V10 and
checks its exact active-state digest after candidate recovery.

The candidate public contract is mandatory: `totalHandCount`, `historyLoaded`,
`loadFullHistory()`. Missing methods cause FAIL, never a fallback PASS. Startup
checks wallet, financial event identity/counts and table funds independently;
history bodies may remain a bounded tail. Full lazy loading is then checked
against financial totals and a separate canonical archive audit. Audit completion
is explicit; it is never represented as completed at safe readiness.

Recorded milestones: shell, verified wallet/safe controls, statistics, validated
history, full canonical audit, stage timings, buffered native Long Tasks, heap
samples, and an isolated cursor count of serialized storage bytes. Cursor byte
counts are not physical IndexedDB allocation. History timing clicks the ordinary `#load-older-history` control when the
checkpoint retained only a tail, waits for validated completion, and confirms
the public loader returns the same complete canonical records.

Use `#qa-evidence-chunk` / `#qa-evidence` for full JSON in a top-level frame, or
`#evidence-chunk` / `#evidence` in the parent. The summary omits stage/heap arrays.
Test databases and bounded sessionStorage receipts are deleted after capture.

## Workflow and native safety checks

`step5e-compiled.html` executes actual compiled 2–10-player hands, rapid duplicate
Call/Jam, pending-decision reload, committed-bot reload, post-payout reload,
manual adjustment, top-up, cashout, presets, player notes, layout, statistics,
redacted JSON download, replay and study-only import. Exact added cases cover
$1/$2 raise-to$16 (1600 cents total), six occupied seats at ten capacity,
$1/$3, $2/$5 and $50/$100 setup, literal $3/$7 with $350 stacks and an actual
$7 postflop opening bet, below-minimum rejection, and100actual pending-decision
DOM rerenders. A full successful workflow now completes11UIhands. The custom
minimum-bet check fails honestly if no actual opening opportunity is observed. Output records exact hand
actions and independently reconciled pots/ledger. No physical download/share
completion is inferred from valid file bytes.

`step5e-native.html` uses verified candidate modules with real native IndexedDB:
normal populated reload, explicit transaction abort, an injected quota error,
stale writer fencing between independent connections, and duplicate settlement/
cashout recovery. Actual quota exhaustion and OS power loss are not simulated.
Two connections in one document are not two physical browser tabs.
`step5e-rollback.html` separately runs the populated V7/V7-R scenario using the
byte-verified candidate runtime receipt: three original settled hands, pending
fourth action, aborted native migration, verified original backup, post-upgrade
settlements/manual adjustment, unchanged V7 safe refusal, V7-R preserved latest
state and single pending-action commitment, resumed candidate after V7-R, and
unknown schema refusal. Its original/recovery readers retain their pinned source
manifests. No real guest save is migrated. This page is not counted implicitly
as executed by any other workflow.

For trusted keyboard evidence, open
`step5e-compiled-frame.html?run=<digits>-<digits>&keyboard=1` top-level. The visible
panel records only browser-trusted keys and zero-detail trusted activations in
the actual application. Navigate setup, start a heads-up game, act, end and cash
out using real Tab/Enter/Space/arrow inputs, then activate **Capture keyboard
workflow evidence**. This records an independently reconciled final snapshot and
actual completed-hand delta; it does not establish screen-reader testing.

For actual multi-tab checks, open the exact same
`step5e-compiled-frame.html?run=<digits>-<digits>&multitab=1` URL in two real tabs.
Start a table in the first, confirm the second reports read-only, capture both,
take over using the ordinary control in the second, perform one legal action,
and capture both again. The visible capture button reads the shared canonical
save independently even while the UI is read-only. Combine both document IDs,
ownership states, financial IDs and action revisions before claiming PASS; one
receipt is deliberately only `OBSERVED`. No production database is opened.

For the exact observed/projection arithmetic fixture, prepare compiled assets,
then run `node tests/step5e-browser/capture-stats-source.mjs`. It refuses if any
production input differs from the compiled source commit. Open
`step5e-exact-stats.html?hours=1` and repeat with `hours=10`. Each builds300actual
engine fixture hands with known +6000cents / +10BB100, seeds only its isolated
native store, loads the byte-identical compiled application, and checks displayed
30and60hands/hour assumptions (+3and+6BB/hour) separately from recorded elapsed
time. It loads all older history through the UI and visits12pages of25hands,
checking300unique identities and unchanged canonical bytes. These are0UI-played
hands and1or10fixturehours, not actual timed sessions; this does not establish
V613's animation-speed whole criterion. The isolated compiled page remains open
for visual inspection, so its report explicitly leaves cleanup NOT_EXECUTED.

## Measurement limits carried forward

Step5D's fresh document did not clear renderer/process heap, disk cache or force
GC. Some runs used HTTP preview with `secureContext=false` / `nativeSHA256=false`.
Record these conditions again. A single observation per cell is `n=1`, not a
latency distribution. A delayed double-requestAnimationFrame paint proxy can
reflect browser scheduling rather than a CPU long task. Long Tasks are not INP.
No physical-device, screen-reader-user, human calibration, hosted CI or expert
review is established by these controls.

The 16 `support.test.ts` cases validate only evidence parameter/receipt/quantile
safeguards. They are not 16 executed browser scenarios or V7 requirement passes.

Statistics DOM readiness is captured by a MutationObserver separately from the
double-requestAnimationFrame paint proxy. Long-task startup maxima only count
tasks that finish before history begins; any task overlapping history is included
in that history responsiveness window, even if its start precedes the phase
marker by a fraction of a millisecond. Readiness-crossing tasks are separate.
These overlapping windows are not additive CPU attribution. Earlier raw captures
are retained unchanged; do not relabel their old derived fields silently.

The compiled page now offers100continuous UIhands at six or ten players. The
stress workflow remains in one session, reconciles every completed hand, reloads
after each20payouts, tops up Hero through the cashier when needed, and queues
depleted opponent stack replenishment through the normal host controls between
hands. All next-hand/hero actions use visible production controls. It has no
controller-driven shortcut. Animation-only card/rules equivalence is separate.

The standard11-hand workflow also verifies session and stake result filters
against independently derived selected-hand BB100 and unchanged canonical data.
The native failure page mounts the actual production UI, requires the visible
last-committed-state/retry banner, reloads safely, then validates a redacted
history download from the recovered UI. Its quota remains an injected native
transaction failure, not physical storage exhaustion.

Native, rollback, exact-stats, keyboard and shared-tab captures expose an ordinary
`#download` or `#qa-download` JSON link. Compiled workflow/stress reports already
use `#qa-download`. Command traces are incremental to avoid repeating every
earlier action in every later result; the complete report retains every slice.

Supplementary source-bound checks (same production candidate, separate execution):

- `step5e-gates.html` fixes its actual iframe width at360CSSpixels and constructs
  the existing three-player $1/$3 raise900 → three-bet2700 → call prefix. It checks
  displayed total/additional/min/max, slider100%=10800,900previous commitment,
  legibility/nonoverlap, and exactly one10800commit after double/stale UI clicks.
  Candidate runtime exports are byte-verified; it is an isolated memory fixture,
  not a full cash session or physical touch test.
- `step5e-exact-stats.html?hours=1&mode=station` runs100actual-engine hands against
  the current station policy using its legal observation, then checks the exact
  compiled display, population warning, hypothetical projection and all100paged
  hand records. These are0UI-played hands and no human-calibration claim.
- After compiled preparation, run
  `node tests/step5e-browser/capture-mixed-stats-source.mjs`, then open
  `step5e-mixed-stats.html`. It adapts the previous400fixture-hand workflow to
  lazy loading and25record pages, preserving per-stake independent arithmetic,
  actual reload, explicit deletion, deletion-marker reload and explicit fresh
  profile checks.400fixture hands remain0UI-played hands.

For V513's actual tab-close boundary, open
`step5e-compiled-frame.html?run=<new-digits>-<digits>&tabclose=1`. Use
`#tabclose-prepare` and wait for PREPARED. In **one** browser automation call,
activate `#tabclose-arm`, wait for `#tabclose-status[data-close-ready=true]`, and
close that actual browser tab promptly. The production Relaxed pace remains
1800ms; no timer interception or artificial delay is installed. If the bot commits
first, the readiness banner changes to CLOSE_WINDOW_MISSED and the attempt cannot
pass the pending-interruption check.

Open the identical URL in a new actual tab. Before executing the compiled app,
the QA reader compares the exact pending sampled action, observation hash,
random-token digest, hand/action revision, ledger/history hashes, bankroll and
table commitments. The controller then resumes normally and the captured
decision ID must appear exactly once. If HTTP fallback ownership remains leased,
confirm the old tab is closed and use `#tabclose-claim`, which activates the
ordinary takeover UI. Then use `#tabclose-payout` to finish through normal UI and
arm another real close/reopen after settlement. On that reopen,
`#tabclose-cashout` verifies one normal session cashout.

Download `#qa-download` in the final tab. Its separate QA localStorage journal
preserves the scalar before/after evidence across closure; it never writes poker
data. Root must retain actual old/new tab IDs and CUA close/open operations.
Different document IDs and pagehide events alone do not prove tab closure. The
page therefore reports AWAITING_TAB_OPERATION_EVIDENCE even when its accounting
assertions pass. This is actual tab closure, not OS/process kill, physical iPhone,
power loss, or interruption *during* a pending settlement. The after-payout case
is explicitly supplemental. Direct stale bot-callback retries remain separate
module-test evidence because the compiled UI exposes no callback injection hook.

`step5e-snapshot.html` is a compact390CSSpx wrapper for actual6/9/10table
screenshots. Open a fresh compiled iframe, choose the occupied count, and use
**Set up selected table through UI** (or configure manually inside the frame).
Every mutation clicks/changes ordinary application controls; the table is paused
through its normal Pause button. **Capture visible table evidence** verifies
seat/board/name/card nonoverlap, Hero at bottom, hidden opponent cards and absence
of horizontal overflow, then offers JSON with the compiled proof and UI trace.
The page does not generate a screenshot: root must capture the actual browser
image. Only the QA `#built-proof` element is condensed to80px/scroll; no production
application style, table geometry or viewport width is changed. Each fresh table
uses a newly named isolated database. Physical-device verification is not implied.

### Observed100-hand attempt1 failure and clock-save regression

The first actual compiled ten-seat attempt recorded100 loop acknowledgements but only99 unique settled hand IDs. Iteration99 repeated iteration98 (`hand-47398b7ad5793cdf54104ea56f059e1f`) with zero additional Hero actions and unchanged financial digest. The preceding `stress-next` acknowledged the unchanged hand; that missing progress assertion was a QA defect. The raw failed capture must remain FAIL and unchanged.

Independent inspection/reproduction also confirmed an application defect: an elapsed-time `tick` set controller busy without notifying UI subscribers, leaving an enabled Next Hand control and “Saved” text while the action guard silently rejected its click. The original capture lacks controller-busy-at-click instrumentation, so its exact historical causal attribution is inferred, not directly observed. The minimal correction publishes busy at the beginning of every commit, preserving the existing action guard and UI draft preservation. No action is queued or automatically replayed.

`step5e-clock-race.html?expect=reproduce` runs against the source-hashed candidate runtime artifact and expects the original connected-button failure. After rebuilding that artifact with the correction, `step5e-clock-race.html` requires visible Saving/disabled controls, one new hand after readiness, harmless duplicate/stale control callbacks, and preserved same-decision draft/focus. This is a controlled memory-port browser regression, not native IndexedDB evidence. Root must execute and retain both actual captures; authored code is not PASS evidence.

The compiled stress runner now checks every expected hand ID, ordinal, unique completion, settled record count and payout count. `stress-next` must change the hand ID, advance the hand number exactly once, and retain session/history. A no-op fails immediately without retry. The release still requires a new actual100-hand run on the corrected compiled candidate.
