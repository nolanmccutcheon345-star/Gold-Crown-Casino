# Patches 8/9 — preflop sizing and short tables

Base source f0fdbc46b056cd6449d9a0a828abf8815751fdc8, containing exact Version 26 application plus the test-only exhaustive preflop partition. Supplied duplicate ZIPs had identical SHA256 8970eeb40e9a20acb5cad37db65f54019ba1a3b023185f4fb379d845ea1350f1. Both patches applied cleanly. No engine, bot policy, money, storage or schema changes.

## Changes
Opening presets: 2.5/3/4/5 BB with proposed dollar totals. Raised-pot presets: 2.5/3/4 times the current bet. Chip-unit rounding, legal limits and explicit final action remain authoritative. Seven pot percentages retained. Phone strip suppresses redundant additional amount only when Hero has no street commitment and More sizes is closed.

Short laptop/tablet layout: full-size seats in a 480px scene, preserving Hero bottom and seat order; height-selected tiers reposition chrome. Phone and tall layouts retain existing geometry. Existing Patch 7 short-height cap, synchronized slider, history-file reset, in-place DOM updates and partitioned preflop assertions preserved.

## Executed browser evidence
- 66-case source-pinned layout/sizing matrix passed; all 123 production hashes verified against current files.
- Seven phone polish checks passed, including 390x400 and 844x390.
- Four accessibility/import workflows passed; these are automated, not VoiceOver.
- Existing 15-control sizing and double-tap commit protection passed.
- 32 new BB/postflop scenarios passed over four viewports and 2/3/9/10 players. Presets do not commit chips; All-in is focus reachable in the scroll strip.
- Facing $18 with $6 already committed: 3x prepares $54 total/$48 additional, matching displayed label.
- Actual native Tab traversal at 1280x580: Table settings and New Session visibly focused despite visual reordering. No screen-reader claim.
- Full cash workflow passed on actual application with isolated native IndexedDB.

The new all-seat fixture initially timed out at 4/5/7/8 seats because its old input whitelist supported only 2/3/6/9/10. Fixture whitelist expanded to all legitimate 2–10 counts; initial harness-error evidence retained. No production requirement was waived.

234 short-layout cases passed: 13 viewports × all 2–10 player counts × preflop/showdown. Eighteen existing desktop checks also passed.

Cash workflow: five completed hands, five settlements, three cashouts, new sessions and active-hand reload recovery. Final wallet $9,694.75 + seated chips $300 = $9,994.75, exactly initial $10,000 minus recorded $5.25 poker loss.

Full standard suite: 2147 passed, 0 failed, 9 skipped. Typecheck, lint and production Vite build passed. All 189 original layout cases passed. The nine skips are seven opt-in PokerKit comparisons and two large accounting runs, not timeouts. Exhaustive preflop partitions ran and passed. Not R1 release signoff.

Evidence: TEST_EVIDENCE/patch89/full-tests.json, build.log, typecheck-final.log, lint-final.log, provenance.json and browser/*.json. Browser checks used Chromium, isolated synthetic fixtures and the actual current application; physical-device claims are excluded.

## Remaining limitations
Physical iPhone Safari, iPad and VoiceOver are NOT_EXECUTED. All-in remains farther along the preflop strip. At shortest windows settings appear below the table; native focus scroll visibility was checked. An 844x390 landscape phone cannot display the entire full-size table above controls; scrolling remains necessary. The historical 10.07s stall remains unattributed. No expert or human-data realism claim. Preserve 302 original acceptance IDs and 86 deferred features; external gates unchanged.
