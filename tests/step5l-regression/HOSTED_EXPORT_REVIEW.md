# Completed hosted endurance: independent export review

**PASS for the checks below; not an R1 release verdict.** Actual candidate source is `3ecea1c2b71c8e8b9963547da676171f91f21716`, packaged by `566f3b11032841c492e6e148bb9a1139e74247b7`. The observed browser was Linux Chrome 155 at 1363 × 936 CSS pixels in an isolated test namespace on the public R1 testing origin. Production data and application bytes were unchanged.

The six original exports contain **105 distinct completed hands**. The first session contains one ten-seat hand; the endurance session contains **104 hands: exactly 100 ten-seat hands and four nine-seat hands (57–60)**. The latter were counted honestly after a busted seat, not silently counted as ten-player hands.

Independent Python verification passed all six public hash chains, redaction restrictions, **2,014 replay frames**, **2,645 events**, **1,909 action-decision identities**, chip arithmetic, refunds and settlements. Thirteen hands contain uncalled refunds. This workload used no rake. A separate executed **PokerKit 0.7.7** check independently ranked all **93 contestable showdown pots**; the remaining **12 pots** were uncontested. All winner sets agreed. These are checks of the same played hands, not additional played-hand counts.

| Account component | Independently reconciled result |
|---|---:|
| Initial virtual bankroll | $10,000.00 |
| First session, 1 hand | +$37.92 |
| Endurance session, 104 hands | −$650.93 |
| Total poker result | −$613.01 |
| Wallet before final cashout | $9,218.63 |
| Final seated chips returned | $168.36 |
| Wallet after cashout and reload | **$9,386.99** |
| Remaining table chips | $0 |

The endurance BB/100 calculation is −312.9471, matching the displayed −312.9. Public event results match visible session/lifetime values. The visible ledger contains one matching final cashout row, and wallet/P&L remain unchanged after reload. Public exports do not contain financial ledger IDs, so they cannot independently establish uniqueness of every buy-in/cashout identity; separate persistence/ledger regression and browser observations remain necessary.

Hand 104 (`hand-83b38c2c1ae76c1d8cd5afcca11d660a`) provides a complete example: Casey posts $1, Taylor posts $2; Drew, Quinn and Sam fold; Hero calls $2; Alex, Morgan, Jordan, Riley and Casey fold; Taylor checks. Taylor and Hero check every remaining street. On `3♠ A♠ 2♦ 8♣ 6♦`, Taylor's `6♣ 2♥` wins the $5 pot over Hero's `8♠ T♣`. Hero ends at $168.36, losing exactly $2; Taylor receives $5, gaining $3 net. No rake is taken. The machine-readable review retains every original action event.

The recovered execution receipt hash, packaging manifest hash and all three compiled assets agree with the hosted observation identity. Screenshots and original observations are hash-bound in `evidence/public-validator/hosted-105-review.json`; screenshots show the actual desktop candidate, with viewport clipping, and are not mobile-device verification.

The final endurance observation phase records 322 bot preparations: p50 111.3 ms, p95 181.5 ms, p99 650.8 ms, maximum 704.4 ms. Those statistics cover that recorded phase, not necessarily all 104 hands. Its raw trace retains 2,000 timing entries and reports 17,140 dropped entries; raw event timing retains 2,000 entries and reports 3,802 dropped entries. Per-operation preparation summaries retain all 322 phase samples. The review preserves these caps and does not infer INP or resolution of the historical 10.072-second outlier.

**Download transport failed.** The six unchanged JSON batches were obtained through the application's ordinary **View/copy JSON** fallback. Export content integrity passed; successful browser file download, iPhone Files export, physical-device performance, real VoiceOver and independent new-user testing are not claimed.

Reproduction uses `verify-public-history.py` on all six original files with `--expected-hands 105` and `step5l-visible-observations.json`, followed by:

```sh
/tmp/ai-texas-step5l-oracle/bin/python tests/step5l-regression/review-hosted-export.py \
  --project /workspace/sites/ai-texas-hold-em \
  --verification tests/step5l-regression/evidence/public-validator/hosted-105-verification.json \
  --output NEW-REVIEW-RESULT.json
```

No source, saved game, original export or deployment was changed by this review.
