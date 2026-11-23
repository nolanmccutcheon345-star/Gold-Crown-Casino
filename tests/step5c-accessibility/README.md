# Step 5C accessible interaction and practice disclosures

Production changes: `src/ui/accessibility.ts`, `src/ui/accessibility.css`, `src/ui/practice-disclosure.ts`, and integration in `src/ui/app.ts`.

Confirmed source defects: the full content render replaced every status node and preserved only selected text-field focus. Core action, navigation-button and native-select focus could fall back to the document on a bot update. The application also lacked the explicit no-real-time-assistance/no-live-client statement and required-rights confirmation on ordinary external study import.

The table now has a persistent polite, atomic live region outside the replaced content. Only public projections supply turn, last action, board, pot, paused/recovery status and exact awards. All 52 card names include rank and suit, with explicit image semantics and decorative glyphs hidden from assistive output. Focus remains at the equivalent control; when a committed poker action becomes disabled, focus moves to the action region, without automatically repeating the command. Skip navigation, visible keyboard focus and reduced-motion handling are provided. Recovery status explicitly says verification is underway and actions remain unavailable; no loading failure creates a new session.

The visible disclosure states offline/virtual-only practice, no real-money gambling or real-time assistance, and no live-poker-client connection. Before file content is read, pasted history is previewed, or selected records are imported, the UI checks the user's rights confirmation. The public import remains study-only and cannot change bankroll, canonical history or poker statistics. This is ordinary application consent, not a claim of independently verified ownership.

## Executed local checks

`npm run typecheck` — PASS.

`npx vitest run tests/step5c-accessibility tests/ui tests/step5b-ui --reporter=json --outputFile=tests/step5c-accessibility/evidence/vitest.json` — **178/178 PASS**, zero failures or skips. Includes ten new tests plus existing UI/layout/sizing fixture regression. The new tests cover public-only announcements for 2/6/9/10-player complete hands, exact rake/payout labels, all-fold settlement, all52 distinct card names, pause/no-table status, rights refusal and explicit disclosure. An initial test incorrectly expected sub-dollar rake at ten players; corrected to the independently calculated 5% of the ten $2 contributions ($1), matching the unchanged engine rule. This was a test assertion error, not an engine repair.

`npx eslint src/ui/accessibility.ts src/ui/practice-disclosure.ts src/ui/app.ts tests/step5c-accessibility tests/browser/step5c-accessibility-frame.ts` — PASS.

## Browser check for root integrator

Open `/tests/browser/step5c-accessibility.html` in the managed preview. Press **Run 2 / 6 / 9 / 10-seat workflow checks** (`#run-accessibility`). The authored harness mounts the production app/controller/engine against a fresh isolated native IndexedDB for each player count; it does not open production guest storage. It checks card redaction, persistent status-node identity, focus across navigation and committed actions, complete hands, payout/accounting, export privacy, refusal before rights confirmation, and confirmed study-only import preserving canonical hands/ledger/wallet. 10 seats use320CSSpx, the others390CSSpx. Read `#result` and retain the executed result separately. **Browser execution was not performed by this lane.** The harness's programmatic focus/click checks are not trusted keyboard or screen-reader evidence.

Existing UI import harnesses must check `#import-rights` and dispatch its native change event before preview; do not remove the new refusal test. Run existing layout, keyboard, notes, cashier and import regression on the integrated candidate.

## Actual-device verification still required

U10 and the screen-reader portion of V518 are not passed from ARIA inspection. On the candidate with VoiceOver enabled in iPhone Safari (or a declared desktop screen reader):

1. Enter as a guest. Confirm the loading verification message is announced and no poker action is available before recovery finishes.
2. Navigate with the reader and, on desktop, Tab/Shift-Tab/Enter only. Use Skip to table and controls, change a setup control, start a table, and locate Fold, Check/Call, Raise-to and sizing descriptions.
3. Verify Hero's two cards are spoken as rank plus suit; unrevealed opponent cards say Hidden card. Check that no future board or private opponent parameter is announced.
4. Complete a hand. Record spoken turn changes, public bets/board/pot, exact awards and rake. Confirm focus stays usable after the action commits and the table updates. Check at2/6/10 seats.
5. Visit history, export a redacted file and save through Safari's Share/Files flow; reopen and inspect JSON. Attempt importing without confirmation (must refuse), then confirm your rights and import as study-only. Verify bankroll and poker results remain unchanged.
6. Record device model, OS/browser/reader versions, observed announcements, mistakes, timings and any clipping. Physical Safari export remains **AWAITING USER VERIFICATION** until the user actually completes it.
