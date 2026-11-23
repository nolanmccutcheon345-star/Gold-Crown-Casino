# X14 provenance helper and integration contract

Original X14: “Lab hands excluded from ordinary win-rate and bankroll performance;
each hand has immutable mode/source/ruleset tag; normal gameplay never forces an
educational outcome.” No original requirement is modified by this implementation.

`src/session/hand-provenance.ts` contains no engine mutator, RNG, deck parameter,
lab deal accessor, storage writer or migration. It supplies the minimal public
origin descriptor and validation needed by the existing cash/history boundaries.

```ts
interface HandProvenance {
  version: 1;
  mode: 'cash' | 'lab';
  source: 'csprng' | 'fixed-deck';
  ruleset: { id: string; version: string; fingerprint: string };
}
```

The only coherent pairs are cash/CSPRNG and lab/fixed-deck. The rules fingerprint
is SHA-256 of the full canonical profile, including stakes, chip unit, rounding,
resolved occupancy cap and source version. It must match the final view and every
replay frame. The provenance object is sealed with the canonical hand, not added
after hashing. Public origin is a descriptor, **not authentication** or proof of
an imported file's claimed entropy source.

Required root-owned integration:

1. Add optional `provenance?: HandProvenance` to `StoredHand` and `PublicHand`.
2. Ordinary new cash records receive `makeCashHandProvenance(view.profile)` before
   their existing `seal(record)` call. The factory is synchronous and returns a
   detached, deeply frozen tag. Normal dealing still calls the existing secure
   engine and has no seeded/lab path.
3. Full `validateData` and incremental newly appended-hand validation both call
   `assertCashHandProvenance(hand)`. Explicit lab/fixed-deck tags cannot be credited
   as cash hands even when their data hash was recomputed. Missing legacy tags
   remain accepted alongside the existing mandatory ledger/hash checks.
4. Public export copies a tag only if it exists, before sealing the separate
   public record. Public import/reload invokes `validateHandProvenance(hand)`;
   malformed versions, extra keys, inherited objects, getters and mismatched
   profile fingerprints are rejected rather than stripped or repaired.
5. Imports remain exclusively in `importedHands`; their source claims never
   authorize wallet/stat credit. `describeHandProvenance(hand,'imported')` reports
   effective `replay-import`/study/nonfinancial regardless of recorded origin.
   `isCashPerformanceHand(hand,namespace)` requires an explicit namespace and
   returns false for imported or lab contexts, and for explicitly lab-tagged
   records even when requested in a cash context.
6. Existing missing tags receive only a nonmutating `legacy-unknown` display
   wrapper. Do not backfill or rehash historical records or rewrite old results.

Helper exports:

- `makeCashHandProvenance(profile)`
- `ruleProfileFingerprint(profile)`
- `validateHandProvenance(carrier)` → validated tag or `null` for missing legacy
- `assertCashHandProvenance(carrier)`
- `describeHandProvenance(carrier, 'cash' | 'imported' | 'lab')`
- `isCashPerformanceHand(carrier, 'cash' | 'imported' | 'lab')`

A carrier needs `view.profile`, optional `frames[].profile`, and optional
`provenance`. No user money or private cards are read by this helper.

Executed on 2026-11-01:

`npm test -- tests/step5b-engine/hand-provenance.test.ts --reporter=json --outputFile=tests/step5b-engine/hand-provenance-result.json`

**14 passed, 0 failed.** Cases cover actual normal `secureDeck` invocation without
overriding its result, source/rules fingerprint, immutable tags, hash tampering,
resealed lab rejection from finance, import masking, legacy unknown labels,
existing populated schema-3 fixture hashes, every-frame rules matching, malformed
and prototype/accessor rejection, and exact JSON persistence. The four populated
street snapshots contain three historical hands each; no old hand was rewritten.
`npm run typecheck` and `npm run lint -- --quiet`: **PASS**.

These helper tests do not by themselves claim completion of X14. The root-owned
controller, storage, public import/export and statistics integration must be
verified before promoting the original acceptance criterion.
