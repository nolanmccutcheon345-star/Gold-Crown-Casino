# Step5E independent integrity and memory verification

This lane uses an independent financial oracle with Node SHA-256 and BigInt
integer accounting. It imports no production hashing, integrity, checkpoint,
projection or poker settlement implementation. Full hand auditing replays the
actual public blind/action debits, uncalled-bet refunds, awards and rake. Compact
financial auditing replays every canonical money event and reconciles exact
session/hand identity, order, wallet and table balances.

`financial-reference.test.ts` covers corruption, independently resealed
inconsistencies, four in-hand recovery streets, study-only data exclusion and
manual resets during active sessions. `large-reference.test.ts` streams the
unaltered 10,000-hand canonical fixture and records equality at 0, 100, 500,
1,000, 5,000 and 10,000 hands in `evidence/canonical-replay-agreement.json`.
These are oracle tests; they do not themselves certify a fast-checkpoint reader.

The large fixture contains eight observed table sizes, 26 top-ups and 101
cashouts, but only 100/200 blinds, synthetic-cash-1.5.0 and zero rake. The smaller
published-version fixture adds 200/500 blinds, older policy provenance and an
exact 50-cent raked hand. Do not describe the large fixture itself as mixed-stake,
mixed-policy or raked coverage.

`public-memory-checkpoint.test.ts` tests the separately requested production
public-memory support. It compares per-seat checkpoints with the original full
history selector over 360 hands, including sparse seat participation, interrupted
serialization, overlapping journals, session changes and forbidden information.
Financial/private-history trust is never conferred by a memory checkpoint type,
shape validation or freezing; the storage recovery boundary must verify its
committed provenance.

Local checksums protect against accidental corruption, not an actor who rewrites
and reseals an entire save. Independently resealed adversarial tests verify
semantic invariants, not an external authenticity guarantee.

Run: `npx vitest run tests/step5e-independent`

The JSON report measures independent Node audit duration only. It is not browser
startup time, checkpoint recovery latency or physical-device verification.

`compact-boundary.test.ts` exercises the actual production compact hooks and
checkpoint/journal reader with 126 engine-settled hands, then journals through
129 hands, a top-up, manual reset, cashout and new session. Only 120 hand bodies
remain resident. It compares accounting against the independent full replay and
checks resealed index, financial, statistics, memory and journal inconsistencies.
It also tests interruptions before commitment and after a lost acknowledgement
for an all-in: 14,700 main pot, 10,000 side pot, 300 rake and 10,000 uncalled
refund. Hero's exact 9,700 net is settled and cashed out once after recovery.

The first compact-boundary run found one accepted inconsistency: a statistics
checkpoint's first hand ID could differ from the financial hand index while its
count, final ID and totals matched. Core fix `a2b9815` now compares every recorded
statistics ID to the canonical financial-index prefix. The retained regression
test passed after that fix. This is a semantic consistency finding, not a claim
that local checksums can authenticate an attacker-rewritten save.

The core lane has 104 distinct tests (41 financial oracle, 1 large streamed replay,
34 public-memory, 28 real compact recovery). Four additional record-level reference
tests preserve read/write cloning, abort atomicity and transaction serialization
after removing whole-database cloning from the test-only IndexedDB reference.
Native IndexedDB, actual browser
tasks and physical devices are tested in separate lanes; the in-process atomic
port here is explicitly a transaction reference.
