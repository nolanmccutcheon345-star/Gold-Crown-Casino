# Version40 — Patch20 rules and screen foundation

Continues Version39 application source41203c1e795fdc7aa2f9b89486886a6b1462a820 and evidence checkpoint31a0fbd6712c38b90e4649784910cf1597bb0b6d.

Applied the uploaded Patch20: six pure side-bet settlement functions/paytables, seven-seat lineup and four deterministic seat styles, optional other-seat/side-bet rendering, sample fixtures and preview page. Existing live blackjack passes none of the new options. No authoritative engine, ledger, controller, migration or save format was changed. Side bets and other seats are NOT playable; the sample screens are not gameplay evidence. External design and notes are retained in TEST_EVIDENCE/blackjack40.

Review fixes: escape opponent names in seat text and accessibility attributes; independently disable Hero action buttons while waitingFor is set even if legal-action input is stale; reject empty legal-action decisions and invalid random lineup indices instead of returning undefined. The waiting label remains plain text for the screen renderer to escape once.

Independent tests cover 2,197 rank triples, money multiple semantics, delayed dealer outcomes, queen-heart jackpot timing, input validation, legal-action restrictions and escaping. These are pure-code checks, not independent casino paytable or strategy calibration.

Initial blackjack suite322PASS/0FAIL/0SKIP; independent10PASS/0FAIL/0SKIP. Final combined receipt is final-vitest.json; totals overlap and must not be added to prior full-suite counts. Typecheck/lint/build rerun after fixes. Original302/86 specification integrity retained. The complete project suite was not rerun for this foundation checkpoint.

Browser preview was NOT verified. The old local preview listener had stopped (connection refused). After restarting the supported preview, the browser rejected acquisition of its error tab under URL policy. No bypass attempted. Uploaded screenshots and external author's checks are not our browser execution.

Save-only checkpoint: retain working public R1 applicationVersion39, productionVersion7 and privateVersion12 unchanged. Live integration still needs versioned wager commands, atomic stake debit/payout, deterministic other-seat dealing, public-exposure ordering, exactly-once settlement, full replay, old-save compatibility and actual browser qualification. Free Bet is separate unfinished work. No acceptance gates promoted. NOT READY FOR R1.

Final combined blackjack qualification: 332 PASS / 0 FAIL / 0 SKIP. Typecheck, lint, production build and specification integrity passed. Existing large-bundle warning remains.
