# Browser evidence policy

The authored Playwright suite is intended for a compatible CI executor with Chromium. Its existence is not evidence of execution. The managed Sites environment requires actual browser QA through Sites preview and cua_repl; no independent browser-control path was used here.

Step 2 actual cloud Chromium evidence: TEST_EVIDENCE/step2/. A continuous six-seat session completed 100 hands, exported through the UI and independently audited. Extra two/nine-seat and ten-seat mobile CSS-iframe hands were completed. Screenshots, public DOM observations, exports, payouts and source hashes are preserved. This is not physical-device/human certification. The mobile iframe export capture timed out; desktop export passed. Details: STEP2_REPORT.md.

Run the authored CI suite with npm run test:browser only in an allowed compatible environment. Hosted GitHub Actions remains NOT_EXECUTED. Wallet cash-out/reload recovery is intentionally absent until G3.
