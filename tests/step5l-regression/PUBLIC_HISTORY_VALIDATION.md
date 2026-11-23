# Independent public-history verification

`verify-public-history.py` uses Python integer arithmetic and SHA-256 with no application imports. It verifies original redacted export files, including each independent batch's hash chain, unique hand and decision identities, every replay frame's event arithmetic and chip conservation, final payouts, split/odd-chip distribution, analytical rake, and permitted card visibility.

It does not drive a browser, independently rank hands, prove every poker action legal, or identify the compiled application. Those checks retain separate source-bound test evidence. Public exports do not contain the financial ledger's buy-in/cashout IDs, so this checker cannot independently prove their uniqueness.

Run it on every **unaltered original export batch in chronological order**. The application limits individual exports by bytes and hand count; do not assume a single download contains the whole archive. Each batch starts a separate public hash chain, which this tool verifies before checking global hand uniqueness.

```sh
python3 tests/step5l-regression/verify-public-history.py \
  FIRST-ORIGINAL-EXPORT.json NEXT-ORIGINAL-EXPORT.json \
  --expected-hands 101 \
  --observations ACTUAL-VISIBLE-OBSERVATIONS.json \
  --output NEW-VERIFICATION-RESULT.json
```

The output path must be new. `--expected-hands` should match the actual completed workload, not a planned target. Without `--observations`, the public record checks run but the visible account check is `NOT_SUPPLIED`.

Record independently observed UI values in cents, including screenshot/DOM evidence paths:

```json
{
  "evidence": ["actual-visible-state-evidence.json"],
  "completeCanonicalHistory": true,
  "totalHands": 101,
  "totalPokerNetCents": 0,
  "initialWalletCents": 1000000,
  "manualAdjustmentCents": 0,
  "walletCents": 1000000,
  "tableCents": 0,
  "sessions": [{"id": "actual-session-id", "hands": 101, "netCents": 0}]
}
```

These are schema examples, **not observed results**. Replace every value with the actual observation. For complete history, every session must contain contiguous hand numbers from one, and wallet plus table must equal starting bankroll plus manual adjustments plus independently calculated poker result. Buy-ins, top-ups and cashouts are internal transfers. For a partial history, set `completeCanonicalHistory` false; only the explicitly scoped hand/result totals can be matched.

The retained historical two-hand fixture independently matches 11 frames, 21 events, nine action decisions, a 318-cent result and the observed final $10,003.18 wallet. This is historical validator evidence, not the new Step 5L endurance workload. The reusable self-test also rejects ten corruption cases, including resealed semantic corruption:

```sh
python3 tests/step5l-regression/test-public-history-validator.py \
  --output NEW-SELF-TEST-RESULT.json
```

For the forthcoming hosted export, retain the actual guest browser run, deployed build identity, complete-hand count, reload observations and screenshots alongside the independent result. Do not report that workload as passed until its exports and final visible financial state have been checked.
