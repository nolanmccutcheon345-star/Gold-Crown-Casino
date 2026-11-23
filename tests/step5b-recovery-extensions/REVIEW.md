# M12 independent integration review

Source inspected: `919ad829132575bd0a4299be201d7bfa3ec57977`.

The tests invoke the actual `BrowserPersistence`, erasure implementation and `SessionController`. The separate asynchronous transaction reference serializes requests, snapshots at transaction start, and publishes `clear`/`put`/`delete` changes atomically. It supports injected clear, put and delete failures. This is executable automated reference testing, **not actual browser/device verification**.

Initial run: **27 tests, 25 PASS / 2 FAIL**. TypeScript and scoped ESLint passed. Raw output: `initial-review.log`.

Verified cases include populated data deletion and explicit restart; rollback at clear/tombstone/lease; interrupted marker removal; stale writer after deletion and after fresh initialization; revision-zero manifest mismatch; unknown markers; ownership and checksum fences; exact confirmation; active-hand and completed-but-seated rejection; and deletion-aware clearing of a failed null-revision initialization.

Confirmed failures:

1. **Stale deletion flag after another tab starts fresh.** Two different owner tokens use actual lease takeovers. An old tab observes deletion, the other explicitly starts fresh, and the old tab takes ownership and retries. It reads the new wallet and reports ready, but the next adjustment throws `PracticeDataDeletedError`, because `BrowserPersistence.load()` never clears its previous `deleted=true` after loading a valid fresh snapshot.
2. **Gap between restart and initialization.** An old tab has an interrupted initial write (`expectedRevision=null`). A second owner initializes, deletes, and explicitly calls `startFresh()`, then closes before the separate initial-wallet commit. The old tab reacquires the released lease, retries and resurrects the pre-deletion initial event, because removal of the tombstone leaves no generation evidence. The regression permits either a genuinely new wallet or a fail-closed deleted state; it only rejects revival of the old pending event. This does not demonstrate resurrection of old played hands: the affected pending write is the initial wallet. A persistent nonpersonal generation fence or an atomic restart+initialization should close this gap.

New-feature real browser verification: **NOT_EXECUTED** by this agent. Parent coordinates the permitted browser surface separately. Production data was not accessed by these tests.

## Final verification after fixes

Applied parent source fixes `4e619f5` (atomic initial snapshot + tombstone deletion; reset stale `deleted` state on load) and `0afc3a4` (discard pending candidates whose initial ledger hash belongs to a different, explicitly recreated wallet).

A follow-up revision-zero test found a third, non-corruption defect: the storage prefix fence preserved the fresh wallet, but the old controller repeatedly retried an obsolete ordinary write and remained in error. The second fix now adopts the fully audited fresh wallet and clears that pending candidate.

The direct port tests now supply a separately constructed valid initial ledger to `startFresh(initial)`. Added cases cover failure during initial segment/current writes; successful atomic restart followed by interruption before controller reload; lost acknowledgement followed by Retry; stale expected-revision-zero write; attempted restart with populated old history; and competing restart requests. No assertion was weakened to accept revival of an old event.

**Final M12 integration: 33/33 PASS.** Combined with actual port migration/retry, incremental validation, the independent full/incremental integrity review, and lower-level erasure cases: **100/100 PASS across 5 files**. Final raw run: `final-review.log`. TypeScript and scoped ESLint both PASS. These are automated test counts, not mapped V7 acceptance counts.

No production code was edited by this independent review lane. New M12 actual browser/device verification remains **NOT_EXECUTED by this agent**; the parent owns that separate evidence.
