# Step 5F external verification pack

**No physical device, screen reader or new participant has passed by preparation of this pack.** Production Version 7 must remain unchanged. The pack is for an identified, isolated candidate supplied by the integrator. A Version 7 observation does not verify the candidate.

## Exact governing criteria

| ID | Original acceptance criterion, unchanged |
|---|---|
| U10 | Core actions operable and properly announced without animation-only meaning |
| U11 | Measure decision compute P50/P95, 10-seat frame responsiveness and input-to-confirm latency on specified phone/desktop |
| V518 | Measure p50/p95 bot response, render time, memory and action error rates on declared reference devices during repeated 2/6/10-seat play; check keyboard/screen reader/color-independent card labels. |
| V707 | Three new test users on specified mobile/desktop view must locate minraise, raise-to total and call/additional amount, play 25 hands; record each actual misclick and observed ambiguity. No fictional completion. |

Source: `docs/specs/acceptance-source.json`, also `V7_All_302_Acceptance_Tests.txt` lines 548–553, 1057–1059 and 1201–1203. V7 Master lines 818–822 additionally call for a real walkthrough on narrow phone and desktop: known/unknown lineup, min-raise/pot-sized raise, 25 uninterrupted hands, history, reload and bankroll edit. Lines 856–859 propose p95 input-to-render below 250 ms on a **defined modern phone and desktop**; that is a target, not a claimed benchmark result.

The governing documents do **not** name an exact phone model, desktop CPU, OS, browser release or screen reader. Those must be declared and recorded before the comparison, rather than guessed. Step 5F explicitly adds actual iPhone Safari, nine- and ten-player seating and extended play. A suitable declared matrix is the tester's actual iPhone/Safari plus their actual desktop/browser/screen reader, repeated at 2/6/10 seats and an additional nine-seat mobile check. An Android/Chrome check is useful if that is a supported release target; it is not fabricated as an already specified hardware model. Emulated Chromium remains a separate category.

## What to use

- [Short tester guide](QUICK_START.md): start here for iPhone, VoiceOver and the three-user workflow.

- [Phone checklist](PHONE_CHECKLIST.md): short physical-device, export and recovery steps.
- [Real screen-reader protocol](SCREEN_READER.md): spoken output and keyboard/gesture observations.
- [Three-user study](NEW_USER_STUDY.md): standardized uncoached tasks and severity rules.
- [Invitation draft](INVITATION.md): ready to send after the candidate access field is completed. No invitations were sent.
- [Feedback form](FEEDBACK_FORM.md), `hand-observation-form.csv`, `three-user-results-template.json`, `device-reader-results-template.json`: blank recording aids, explicitly NOT_EXECUTED.

## Instrumented exact-code candidate

`tests/browser/step5f-external.html` loads a prepared manifest at `./step5f-candidate/manifest.json`, or a same-origin `?manifest=...` URL. It verifies each asset's bytes/SHA-256 and the index's actual JS/CSS references before loading. It refuses the known live production origin and file URLs. The only storage adapter remaps the ordinary guest database to a unique `ai-texas-step5f-external-<run>` database; all poker actions remain ordinary app controls. The stable `run` in the complete URL preserves this isolated save across reloads and deliberately shared tabs. New run IDs create new test accounts.

The integrator must package the exact compiled candidate and its real build receipt; no default manifest or invented candidate URL is provided here. The old Step 5E bundle must not be relabeled as Step 5F. A separate test origin remains required; the namespace adapter is an additional safeguard. No production save is read, converted or imported by this harness.

Use `measurePerformance=1` to opt in to the reviewed numeric timing bridge. Without it, detailed bot timings are **NOT_MEASURED**. The observer records only public display fields and fixed timing names/numbers. It has no controller, engine-state, database-read, deck, hole-card or private-policy access. It never submits actions. The harness itself and its observation controls are development-only and must not be added to the normal production module graph.

It captures trusted clicks, input-to-visible-DOM changes, a following-frame proxy, supported Long Tasks/Event Timing and coarse `performance.memory`. **A DOM change is not independent proof of a durable commit; a following animation frame is not physical paint; raw Event Timing is not a complete INP calculation.** Unsupported APIs are marked unavailable. DOM announcement text is not spoken screen-reader evidence. Operator-declared physical hardware or participant independence still requires actual observation.

Each phase has bounded timing samples. If a cap is reached, dropped counts are disclosed and phase quantiles become unavailable; count/mean/max still include all observed samples. Export each phase report, then select the next phase and use **Begin next measurement phase (export first)**. This starts a new observation window without changing the poker state. Capture before reload, then capture the recovered run separately. Intentional bot think time is distinct from `bot.policy`/`bot.prepare` compute phases.

Observation-file Share/Download/Show JSON is only a diagnostic export. The **ordinary app's History → export to Files** is a separate required physical check. It must not be marked passed because the diagnostic file downloads.

## Execution boundary in Work

The available computer interface exposes the cloud browser; native desktop apps and screen-reader speech capture are not available. Tool discovery exposed no VoiceOver/NVDA/TalkBack/Orca control. `command -v orca`, `speech-dispatcher` and `spd-say` found no command on PATH. This is an execution-environment limitation, not a finding about the application. Synthesized speech, DOM text and ARIA assertions do not replace a real screen reader. U10 and the spoken/device portions of V518 remain NOT_EXECUTED until actual hardware/software is used.

## Review and acceptance

`contracts.ts` validates record completeness and rejects emulation as physical proof, duplicate participants/hands, missing observations and missing spoken evidence. Passing this validator does **not** prove that a person participated, answers were correct, or a gate passed. A reviewer must inspect actual artifacts and outcomes, preserve failures, and update the original-ID tracker only after the complete criterion is satisfied. No new acceptance IDs are introduced. All 302 requirements and 86 deferred features remain unchanged.

## Portable exact-byte packaging

After the integrated candidate's release suite produces a successful source-bound receipt, run:

```sh
node tests/step5f-external/prepare-candidate.mjs TEST_EVIDENCE/step5f/<release-run>/manifest.json
```

This refuses changed production inputs or compiled bytes, failed/missing checks, unreceipted dist assets, symlinks, and overwriting an existing candidate. It creates `tests/browser/step5f-candidate/`, a ZIP and a separate SHA-256 receipt. The wrapper is bundled with the lockfile-pinned esbuild; application bytes are copied unchanged. Read [PORTABLE_CANDIDATE.md](PORTABLE_CANDIDATE.md) before sharing. Packaging does not create a hosted staging URL. Plain LAN HTTP is not a supported secure-context physical-device test path.

`package.test.mjs` uses explicitly synthetic toy receipts to exercise refusal conditions; these tests never count as an executed release candidate or human/device checks.
