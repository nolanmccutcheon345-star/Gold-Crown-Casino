# Step 5B table configuration evidence

This lane implements pure configuration helpers in `src/session/configuration.ts`.
They are designed to run within the existing controller's atomic candidate/CAS
transaction. The controller and browser wiring are verified separately by the
integrator; these unit/integration tests alone do not close a V7 acceptance ID.

| Original ID | Original criterion reference | Executed support |
|---|---|---|
| D02 | 10 seats, 6 occupied including Hero; empty seats distinguishable, no empty bot action | Sparse physical IDs, six dealt hands and five bot profiles, correct sparse blind/actor IDs; empty-seat visual evidence remains browser-owned |
| D08 | Reconfigure seat between hands; next hand uses new seat/stack/profile, prior hand untouched | Real engine next-hand roster/stack/profile transfer, immutable canonical completed hand, replay/export round trip, independent Hero wallet/table reconciliation |
| D10 | Clone named preset and modify rake; original preserved and new saved | Independent named clone, changed rake, original unchanged, no live/history/ledger effects |
| U01 | One-click live $1/$2 preset; nine handed $300, fully editable and called synthetic | Exact editable preset helper with explicit synthetic disclosure; one-click browser wiring remains integrator-owned |
| U09 | Preset custom save/load; seat profiles/stack/rake restored exactly without altering unrelated histories | Seeds, exact targets, rake, deterministic profiles, copy isolation, no session creation or financial effect |
| V706 | Rule profile freeze across active hand; next hand new rules and ledger/replay consistent | Queue never mutates in-flight hand/profile/sample; exact real-engine new rules, denomination residual transfers and policy identity, old replay remains valid. Straddles remain deferred per governing V7 scope. |

Executed 2026-11-01 in the isolated config worktree, baseline 9d937a3 plus shared
contracts 68c561f/7b89f10 and engine e3314f6. Repeated after the new 1.4 policy
checkpoint 700bf53 with the same 36 passing results (`evidence/results.json`):

- `npm exec vitest run tests/step5b-configuration`: **36 passed**, 2 files, 0 failures.
- `npm run typecheck`: exit 0.
- `npm exec eslint src/session/configuration.ts tests/step5b-configuration`: exit 0.

The automated tests include rejected malformed/stale/duplicate requests, exact
retries, persisted queue recovery, legacy absent optional fields, frozen old bot
versions, custom/sourced-rake validation and denomination changes. Hand financial
net remains -100 cents in the deterministic fold fixture. Setting Hero's next
stack from 19,900 to 30,000 cents transfers 10,100 cents from wallet to table,
leaving 969,900 wallet + 30,000 table = 999,900 cents. Setting it to 10,000 returns
9,900 cents to wallet with zero poker P&L; immutable hand net stays -100 cents.

No browser or physical-device tests were executed by this lane. Full controller
integration, persistence interruption/CAS and browser/mobile feature gates must
remain open until their own executable evidence is collected. No original
acceptance IDs or criteria, deferred features, engine settlement records or
published site were modified by this lane.
