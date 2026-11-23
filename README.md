# Gold Crown Casino

Virtual-chip poker and casino simulator, Patch 112. [Play the live game](https://ai-texas-hold-em.stevemccutcheon89.chatgpt.site/).

This checkout contains the game, assets, tests and build scripts. The [Patch 112 release](https://github.com/nolanmccutcheon345-star/Gold-Crown-Casino/releases/tag/patch-112) includes the complete deployed snapshot and instructions for restoring historical evidence and fixtures.

# AI Texas Hold Em
Independent ChatGPT Site — Audited V7 + Acceleration Addendum. Virtual-chip, single-player No-Limit Hold’em. **R1 candidate under verification; not approved for production release.** No connection to Poker MaxEV.

## Run
Node 24, npm and Python 3.12 for the independent oracle:

```sh
npm ci
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
node scripts/check-spec-integrity.mjs
```

Read IMPLEMENTATION_STATUS.md for exact executed checks, current defects, source revision and next task. `docs/specs/` preserves all four supplied source PDFs and normalized text. `Acceptance_Tracker_V7_302.csv` and `BACKLOG_86.csv` preserve all original records; execution is separate in `ACCEPTANCE_STATUS.csv`.

## Boundaries
- `src/contracts`: versioned interfaces; integration owner approval for changes.
- `src/core`: sole poker rules, deck, evaluation, chips and payout authority.
- `src/bots`: restricted observations and advisory action decisions only.
- `src/ui`: host/live/study presentation and action dispatch; no duplicate rules engine.
- `src/storage` and `src/session`: versioned guest persistence, verified checkpoints, wallet ledger and exact recovery.
- `tests`: independent fixtures, property tests, PokerKit oracle and browser journeys.
- `TEST_EVIDENCE`: actual command logs and verification manifests; no inferred PASS.

Local authority isolates bot observations and displayed cards. It does not make cards cryptographically secret from a person inspecting their own browser. Bots are synthetic development policies, **NOT HUMAN-VALIDATED**. No real-money services, live-platform integration, solver EV or earnings forecasts.

## Gates
G0 architecture/test harness → G1 authoritative cash engine → G2 integrated table → G3 money/recovery → G4 measured bot behaviors → G5 R1. Only then R2 Sit & Go and R3 whole-field MTT. All 86 future features retain dependencies and deferred status. A passing unit suite is not a release-gate PASS.

## Continuation
Read `IMPLEMENTATION_STATUS.md`, `ARCHITECTURE_CONTRACT.md`, relevant supplied specification and latest source. Preserve exact project ID in `.openai/hosting.json`. Do not create a replacement Site. Use scoped branches/worktrees and run integration checks after merging. No unattended jobs are claimed; workflow definitions alone do not establish that hosted CI ran.

## Repository and CI

Read [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), [LICENSE_DECISION.md](LICENSE_DECISION.md) and [release/restore guidance](docs/RELEASE_AND_RESTORE.md). The repository must stay private. No open-source license is selected.

`.github/workflows/verify.yml` defines bounded critical, independent PokerKit and exact compiled-browser jobs for source changes, with explicit manual high-volume release checks. `.github/workflows/resource.yml` defines the separate 10,000-hand resource run. Workflows grant read-only access and never deploy a Site. Their presence does not prove hosted execution; actual run URLs and commit-bound artifacts are required.

The preserved Step 5L report records 229/237 qualified R1 checks, 302 unchanged original criteria and 86 deferred features. Use the newest evidence register for the current candidate; do not promote external human/device tests based on CI results. Production Version 7 stays unchanged until explicit final authorization.
