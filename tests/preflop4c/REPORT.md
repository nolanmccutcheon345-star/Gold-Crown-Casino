# Step4C preflop audit and executed evidence

This lane owns preflop policy only. The independent population/full-hand verifier is a separate workstream. No human or solver equivalence is certified. Runtime change: `4b023d9`, plus shared pricing helper from the strategy lane. Frozen previous policy remains unchanged.

## Root cause and definitions

The published 9.48% UTG /19.99% BTN values were **six-handed,100BB,neutral/default-seeded TAG,zero-rake,no-ante entry masses**. All169 classes were correctly weighted by their6/4/12 physical combinations (1326 total). They include open limps, so calling them RFI would be wrong. Exact original RFI was9.2939765% UTG /19.5813807% BTN; original limp masses0.1860094% /0.4098779%. They are not all-hand VPIP. Physical six-max early labels were correct; the additional early seats in full-ring were collapsed into coarse buckets.

The original ordinal hand model under-recognized first-in initiative and applied defending-style odds pressure to unopened opportunities. A total-seat penalty also tightened a folded-to button despite the same two active blinds. The fix adds a versioned skill/position-aware initiative prior, uses publicly remaining players behind, and graduates full-ring early pressure. This widening is an authored strategic hypothesis rather than mathematical proof of positive EV. A separate confirmed arithmetic defect priced short-stack calls against refundable excess:3800c into the eligible8000c was incorrectly read as15.833%, now47.5%. Chips and settlement remain engine-owned.

The current model deliberately does not infer card-bunching from folded hands. Folded-seat invariance is a declared synthetic simplification, not a universal statement about true poker strategy.

## Exact paired model comparison

Each percentage below exhaustively weights all1326 physical combinations; no sampling confidence interval applies to a deterministic model mass. Actual default profiles—including numeric traits, skill and stable identity—are embedded in the compressed report.

|Profile|Seats|Physical role|Old entry|Old RFI|New entry|New RFI|
|---|---:|---|---:|---:|---:|---:|
|tag|2|BTN/SB|29.50%|28.89%|44.53%|43.60%|
|tag|6|UTG/LJ|9.48%|9.29%|15.32%|15.01%|
|tag|6|BTN|19.99%|19.58%|33.74%|33.03%|
|tag|9|UTG|8.83%|8.66%|11.35%|11.12%|
|tag|9|BTN|18.85%|18.47%|33.74%|33.03%|
|tag|10|UTG|8.62%|8.45%|10.22%|10.02%|
|tag|10|BTN|18.48%|18.10%|33.74%|33.03%|
|stronger-reg|2|BTN/SB|36.48%|36.31%|60.20%|59.95%|
|stronger-reg|6|UTG/LJ|10.51%|10.44%|18.44%|18.34%|
|stronger-reg|6|BTN|23.86%|23.74%|45.54%|45.35%|
|stronger-reg|9|UTG|9.65%|9.58%|13.53%|13.45%|
|stronger-reg|9|BTN|22.27%|22.15%|45.54%|45.35%|
|stronger-reg|10|UTG|9.38%|9.31%|12.13%|12.05%|
|stronger-reg|10|BTN|21.76%|21.65%|45.54%|45.35%|

All23 genuine first-in physical seats across2/6/9/10 tables ×7depths ×8archetypes =1288 configurations were enumerated before and after. Stack depths20/40/60/100/150/200/300BB. BB is excluded from RFI: it cannot face a genuine first-in opportunity after everyone else folds.96 additional BTN ablations vary TAG/strong profile, neutral/low/mid/high population, skill.25/.65/.9 and zero/5% rake capped4BB with the same personality seed. Stakes do not force skill.

|TAG six-max depth|Old UTG RFI|New UTG RFI|Old BTN RFI|New BTN RFI|
|---:|---:|---:|---:|---:|
|20BB|8.11%|12.83%|16.80%|29.96%|
|40BB|8.47%|13.62%|17.79%|31.32%|
|60BB|8.87%|14.34%|18.73%|32.34%|
|100BB|9.29%|15.01%|19.58%|33.03%|
|150BB|9.67%|15.72%|20.36%|33.61%|
|200BB|10.08%|16.34%|20.90%|33.93%|
|300BB|10.50%|16.84%|21.31%|34.12%|

## Actual decision sampling

Final paired experiment:42 contexts ×4096 uniform physical-card/action opportunities ×2versions =344064 actual decisions. Trials use independently generated test RNG; card RNG is separate from per-trial action entropy. Every before/after pair has identical card-sequence hash. This prevents variable raise-sizing draws from changing later deals. The preliminary report used a shared stream; its counts are explicitly superseded, although exhaustive masses were unaffected. No runtime policy changed after the first candidate measurement.

|100BB six-max profile/role|Old raises /4096|New raises /4096|New RFI|Wilson95% interval|
|---|---:|---:|---:|---|
|tag UTG|367|593|14.48%|13.43–15.59%|
|stronger-reg UTG|425|741|18.09%|16.94–19.30%|
|tag BTN|799|1336|32.62%|31.20–34.07%|
|stronger-reg BTN|967|1817|44.36%|42.84–45.89%|

Intervals condition on one fixed synthetic individual and configuration. They are not human-population or correlated-session intervals. Largest RFI sampling deviation from exact model across84 before/after measurements was2.76 nominal standard errors; no material discrepancy was identified. Do not add repeated baseline/telemetry executions to unique experimental sample counts.

## Independent primary reference comparison

ART/GTO publisher pages report its own six-max100BB solved RFI19.9% UTG/46.5% BTN to2BB. Rake is not specified on the pages read, so the comparison is only partly matched. Our new TAG is deliberately more conservative; the stronger regular is closer but is not solver-verified. GTO Wizard documents distinct rake/depth/open-size trees, emphasizing why one chart is not universal. Sources and assumptions are in `src/bots/PREFLOP_MODEL_1_2.md`; additional CO reference read: https://artgto.com/learn/ranges/co/open/.

Before edits, four preregistered structural/qualitative checks failed. The three non-arithmetic checks concern a synthetic modeling choice and reference-motivated hand classes, not exact human targets. After edits all six new coherence checks passed, including added physical-label/invalid-input coverage, along with the3audit tests and12previous preflop tests:21/21PASS. TypeScript and scoped ESLint passed. The full report-only run executes3tests; counts overlap and must not be added.

Reproduce the final matrix: `PREFLOP4C_REPORT=1 npm test -- --reporter=verbose tests/preflop4c/audit.test.ts`. Fast lane regression: `npm test -- --reporter=verbose tests/preflop4c tests/preflop4b/preflop.test.ts`. Baseline logs, final logs, old/candidate compressed reports and CSV remain under `evidence/`. Root independently integrates and reruns the repository regression and browser tests.

No complete-hand human dataset or independent expert review was obtained by this lane. Full-hand coherence, rare-action coverage, postflop exploit probes and cash-game release recommendation belong to the separate verification report.
