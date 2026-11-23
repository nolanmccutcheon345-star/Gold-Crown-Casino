# Step5D accessibility lane

The original U10/U11/V513/V518/V707 criteria remain unchanged. No whole-criterion PASS is proposed from this lane's authored DOM checks, existing cloud evidence or a manual-testing plan. Actual screen-reader/device/new-user execution is still required, as detailed in [DEVICE_VERIFICATION.md](DEVICE_VERIFICATION.md).

## Executed locally

At lane checkpoint `af96453` (production identical to Version9 source104b9d6): typecheck PASS, scoped ESLint PASS, **19/19 tests PASS**,0failures/0skips, in2files. Nine new tests independently verify the audit's ID-reference checks and numerical contrast thresholds;10existing tests verify public announcements/card names/import disclosure. These are supporting software tests, not19passed V7 requirements. Logs and machine-readable results are in `evidence/`.

Primary W3C pages were checked for contrast and target-size methodology. This deliberately bounded audit is not a WCAG certification or a complete accessible-name implementation. It does not falsely treat44px as the universal AA minimum;44px is the project's core-button engineering check. Gradient/translucent backgrounds are recorded as NOT_MEASURED rather than guessed.

## Actual-browser runner for the integrator

Open `/tests/browser/step5d-a11y.html`, press `#run-a11y`, retain `#a11y-result` after all six cases complete. It mounts the actual production app/controller/engine using an explicit isolated in-memory port at2/6/10seats and320/1280CSSpx widths. It never opens production guest data.

Checks: held-load status/no unverified wallet/actions, control names, unique IDs, valid ARIA description references, ordinary keyboard tab order, named navigation/main landmarks, minimum core-control geometry, measurable solid-color text contrast, persistent public announcement node, and live sizing-editor behavior through an ordinary clock save. It also confirms the clock saves leave authoritative game/wallet/ledger/hands unchanged. Programmatic DOM `.focus()`/`.click()` are labelled accurately; trusted keyboard and actual reader output need separate interaction.

### Source finding to reproduce before repair

At Version9, `render()` retains expanded details only in Host setup (and separately notes), while live `.sizing-shortcuts` and `.sizing-basis` are recreated collapsed. `focusSelector` does not identify their ID-less summaries. Unsubmitted custom percent/BB/increment input values are also not preserved. A normal5-second clock-save render can therefore collapse the editor, drop summary focus and discard a user's unsubmitted sizing draft. The new fixture explicitly checks this behavior after calling public `controller.tick()`; it does not mutate the game or invoke a replacement poker engine. Preserve the pre-fix FAIL and rerun unchanged assertions after the root integrator repairs confirmed production behavior.

**This lane has not executed the browser runner.** Root owns browser control and will attach actual results separately. A source finding is not misreported as an observed browser failure. No production UI file was changed by this lane.
