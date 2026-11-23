# Follow-up R1 coverage audit

The follow-up adds **27 whole-criterion PASS mappings** and **one FAIL mapping** from the initial audit. It does not change `ACCEPTANCE_STATUS.csv`, release scope, any original criterion, or production code.

| Original ID | Exact evidence added or reviewed |
|---|---|
| A04, A10, V402 | Production CSPRNG consecutive hands, no forced ordinary deal, folded-Hero privacy, fixed committed runout, independent bot entropy |
| C10 | No-rake to 5%-cap session change retains immutable old rules, rake and net through reload |
| M03, M04, V406 | Folded dead money, live eligibility, exact three-tier tied rake/refund/odd-chip accounting, idempotent settlement |
| X06, X07 | Actor-specific cumulative short-raise reopening with preserved full increment and finishable hands |
| X05, X11, V611 | Two 200-hand legal session journeys: mixed stakes, active-hand external wallet edit, epochs/reasons, top-ups, reloads, exact cashouts and per-hand-BB statistics |
| V404 | Unknown and Random assignment identity persists through hands and reload; no public latent profile |
| V403, V416 | Forbidden getters and hidden-card/deck substitutions across streets, all eight policies and range/Monte Carlo inputs |
| F01 | Independently enumerated 1,326 physical combos; TAG six-max 100BB BTN open mass exceeds UTG; current preflop regression |
| F06 | River has no future gutshot draw; future-draw and semibluff weight removed |
| F18, V434 | Two observations cannot produce confident long-term inference; bounded priors, permitted memory and retention |
| R16, V609, V704 | Public action/showdown taxonomy; folded/private-card substitutions cannot leak into another observer's memory/ranges |
| V426 | Correct own-BB denominator, refunds, one rake debit, study-import exclusion and mixed-stake disclosure |
| V607 | Redacted public export and study-only import cannot forge paid outcomes; U08 completeness remains separate |
| M08 | Honest local-inspectability disclosure plus observation boundary tests |
| V419 | The original alternative permits explicit absence of a human benchmark; reports state that absence without claiming human sequence matching |
| Y15 | Session-block clustered uncertainty and separate policy/population results; paired worlds are not counted independently |
| X10 — FAIL | Required projected live-equivalent hours are absent; same existing GAP-PROJECTED-PACE as G04/V613 |

Every proposed row has exact original title/criterion, assertion rationale and evidence in [coverage-audit.csv](coverage-audit.csv). The file also retains the other 108 unresolved release-critical whole criteria and explains why no complete mapping was awarded. Candidate filenames alone never earn PASS. Root browser evidence can close further rows separately.

## Actually executed

Nine additional definitions passed with exit 0 on engine 0.3.0 / synthetic-cash-1.3.0 / practice-cash 0.3.0. This includes 400 controller-completed hands, not 400 independent realism tests. The bots use a disclosed legal fold/check/call test double for the long ledger fixtures. Production source was not edited.

Existing coverage is supported by the integration owner's inspected 537/537 result at `f60d3d3`, copied unchanged with source path in [coverage-source.json](evidence/coverage-source.json). Counts overlap and must not be added together. TypeScript, scoped ESLint and original-package integrity checks returned exit 0. Initial failures are retained, including a first four-assertion session run that exited 1; it is not a passing run.

## Status after this proposal

| Count basis | PASS | FAIL | BLOCKED | NOT_EXECUTED |
|---|---:|---:|---:|---:|
| All 302 original whole criteria | 111 | 18 | 5 | 168 |
| 237 release-critical whole criteria, including three external device/usability gates | 111 | 18 | 0 | 108 |
| Same 237 rows, cash-only component status | 117 | 18 | 0 | 102 |

Six mixed cash/tournament rows remain whole-row NOT_EXECUTED while their cash component passes. The five human-validation blockers remain distinct external claim dependencies. Physical iPhone export remains AWAITING USER VERIFICATION. V707 requires actual three-user/25-hand usability evidence.

U08 remains unresolved because actual browser inspection found missing public policy-version export metadata. The nine new tests do not fix that defect or authorize its PASS. Broad browser/device checks, exact dense call-curve smoothness, sparse gutshot calibration and independent validated strategic benchmarks are not inferred from nearby tests. No expert review or human calibration is claimed. **NOT READY FOR R1** remains the recommendation until the listed release-critical gaps are resolved.
