# Patch 4 — phone seat ring

Base: Version 23, saved source 7320c4b0a8c95c29639981c9ad954d5ed46e3eae.
Only src/ui/table-layout.ts application code changed, matching the supplied Patch 4: compact coordinates for 3, 5, 7, 8, 9 and 10 seats. No engine, policy, financial, persistence, desktop geometry or scene dimensions changed. The Version23 showdown list fix is retained.

Executed verification:
- 12/12 existing layout unit tests PASS, all 2–10 counts at 11 scene widths.
- Typecheck and Vite production build PASS (existing large-chunk warning).
- Targeted ESLint and git diff whitespace checks PASS.
- 105/105 real Chromium iframe layout cases PASS: 2,3,6,9,10 players; 320,375,390,430,768,1280 and landscape844 widths; preflop, active river and showdown. Seat/board bounds, overlap, labels and horizontal overflow assertions unchanged. This older matrix's shortcut check is conditional; it does not independently requalify every pinned action-bar interaction.
- Nine/ten-player 390px visual screenshots captured. Cropped screenshot API timed out; full browser captures retained instead.
- Governing specification integrity PASS: original302 IDs and86 deferred features unchanged.

Evidence: TEST_EVIDENCE/patch4/{layout.json,build.log,browser-matrix.json,nine-player.jpg,ten-player.jpg}.

The full2115-test regression was not rerun for this presentation-only change. Prior preflop-range and archive-reconciliation timeouts remain open, as do physical iPhone/VoiceOver/external gates. No R1 readiness or physical-device PASS claimed. Main production Version7 and current R1 deployment remain unchanged in this patch task; save this as an unpublished development version.

Reviewer export: exact Version23 application/test source and configuration, with large historical datasets/profiles and TEST_EVIDENCE omitted explicitly in EXPORT_MANIFEST.txt; Patch4 is provided separately. ZIP CRC and src/ui/app.ts equality against7320c4b verified. The attempted full1.1GB archive was not delivered: upload failed and archive validation found a bad header. Use the validated reviewer export; native Git retains full history/evidence.
