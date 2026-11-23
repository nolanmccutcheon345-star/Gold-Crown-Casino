# Version37 — playable classic blackjack

Continues Version36 (`3612b585e70fadb1b68cefc2758f02c01980f273`) without changing the poker engine, bot policies or tournament schemas. This is a test-site development milestone, not R1 signoff.

## Implemented

Eight classic tables now support betting, hit/stand/double, splits up to four hands, permitted surrender, insurance/even money, settlement, rebet and leaving the table. The ninth catalogue item, Free Bet, remains disabled; six illustrative side-bet paytables remain previews. The existing classic engine alone owns cards, legal actions, debits and payouts. Casino ante defaults to50¢ once per round including splits; home has none. Configurable ante is frozen when seated.

Separate blackjack wallet starts at$2,000. Explicit balance adjustments require leaving the table and a reason; no cash-poker or tournament transfer occurs. Live hints use only the public view, and the count coach excludes the unrevealed dealer card. Strategy/count advice remains approximate and uncalibrated. Review counts only actions actually made with coach/hint enabled, and says model comparison rather than correct casino strategy.

## Persistence and integrity

Separate versioned IndexedDB storage atomically commits the current checkpoint, independent committed-sequence anchor and new immutable closed-shoe records. Each hot action verifies/replays only the current bounded shoe. Recovery/full audit traverses every archived record and independently reconciles ledger, cards and statistics. Completed records are not rehashed/rewritten each action. Candidate state is exposed only after successful storage. Stale concurrent actions fail read-only. Failed writes retain the exact candidate for retry; lost acknowledgement checks committed identity before replaying anything.

Corruption, missing anchors, missing/reordered archives and orphaned genesis fail closed. A verified previous snapshot can be exported as a **private recovery artifact**; it is never silently restored because it may predate a completed payout. Public history exports omit future shoe cards and the active hidden dealer card. Local hashes detect accidental corruption, not hostile user tampering. Clearing/evicting browser storage can remove saves; local persistence is not an off-device backup guarantee.

No Version36 blackjack data migration is needed because it created no live saves. Code rollback toVersion36 leaves the new blackjack database untouched but cannot play it; resuming requires compatibleVersion37 code. This does not constitute an imported/downgraded wallet or automatic recovery merge. Cash and tournament databases are unchanged.

## Evidence and defects

Evidence under TEST_EVIDENCE/blackjack37 and blackjack37-independent. Independent tests reproduced a temporary initial storage-read Retry failure; controller initialization now retries correctly while corrupt data remains blocked. Review also corrected a test/coach denominator so unreviewed actions cannot inflate accuracy. Browser initial concurrent-tab fixture stopped because it had not prepared a bet in the second tab; the test setup was corrected, with the original result retained. No acceptance target was weakened.

The storage workload completed1,000 rounds /2,500 deal-action commits using a seeded Node memory adapter. Final logical JSON archive1,175,128bytes; maximum hot checkpoint16,281bytes (37active commands). Commit/action p95:2.641ms rounds1–100,1.418ms101–500,1.500ms501–1000; maximum6.638ms. Full independent audit500.8ms and final wallet$1,947 exactly matched the independent ledger from$2,000. A prior same-workload run reached23.01ms maximum/940.8ms audit. These are Node timings and logical bytes, not browser origin usage, steady-state heap or physical phone benchmarks.

The actual browser uses Linux Chromium, isolated test IndexedDB and fixed-size frames. Native interrupted-transaction abort is an explicit simulation of quota-style failure; it is not measured device quota exhaustion. The cached-page test dispatches a synthetic persisted pageshow event and exercises the existing reload/recovery path; it is not Safari BFCache certification.

## Remaining work

Implement and independently verify Free Bet and individual side-bet settlement before enabling those wagers. Exact finite-deck/resplit strategy, independently qualified count indices and empirical house-edge estimates remain separate work. Physical iPhone Safari gameplay/export and real VoiceOver are not executed; cash R1 human/device/CI gates stay open. The historical10.07-second cash stall is not attributed or fixed by this work.

All302 original acceptance requirements and86 deferred IDs remain unchanged. Blackjack is separate authorized scope; automated test counts are not acceptance IDs. Main productionVersion7 and original privateVersion12 must remain unchanged. **NOT READY FOR R1.**

## Executed Version37 qualification

- Typecheck, lint, production build and repeated byte-identical build: PASS. Bundle warning remains: JavaScript790KB /262KB gzip; no performance exemption inferred.
- Full standard Vitest run: **2,581passed,0failed,9skipped**,756.1seconds. Seven skipped PokerKit comparisons and two optional10,000-hand accounting batches were not rerun. Exact names are retained in full-tests.json.
- Final targeted blackjack suite: **190passed,0failed,0skipped**. This includes final persistence and UI refinements made while the full suite was running; test totals overlap and must not be added.
- Actual Chromium live-browser harness: **36checks passed**,48 measured rounds across eight tables at320×568,390×844,1366×768, plus three concurrent-tab settlement scenarios. Includes reload, synthetic cached-page reload, public export/full audit and stale-writer rejection. Round-workflow p50=46.3ms,p95=723.5ms,max=973.4ms; these include polling/reload and concurrent regression workload, not isolated engine timing.
- Actual native IndexedDB: **12checks passed**, including interrupted transaction, lost acknowledgement, invalid cards, missing anchor/archive and orphan genesis.
- Practice/lobby screens: **42checks passed** across the same three widths; samples are separately labelled and not counted as played rounds.
- Cash regression: four complete browser workflows at2/6/9/10seats including history export and study import. Tournament regression: complete six-player47-hand event with reload, Hero fifth, balance$1,980 after$20entry and$0prize.
- Manual browser play: split two ten-valued cards into two winning hands; net+$9.50 on two$5hands and exactly one50¢ante. Keyboard betting/Hint/count coach/decision review worked. Phone-width live round completed net+$4.50 on$5bet after one50¢ante. These are synthetic virtual-chip examples, not profitability evidence.

Source and build hashes are recorded in TEST_EVIDENCE/blackjack37/provenance.json; browser JSON and screenshots in the same folder. The original302-ID registry and86future-feature register passed their preservation check. No physical-device, real VoiceOver or independent-human acceptance gate is marked passed. Deployment is restricted to the existing isolated R1 test Site.
