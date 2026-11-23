# Step4B independent verification

The runtime tested matches main `8a48e65` exactly for policy, profiles, preflop, features, strategy, ranges and engine. New decisions use `synthetic-cash-1.1.0`; frozen source remains version1.0. Test implementation commits are `7d47f12`, `f71db23` and the subsequent evidence commit. All measurements are synthetic. No human holdout, solver reference or real-poker skill claim is supported.

## Executed

- Exact original AA audit:1/1PASS,8000 old choices, all legally applied. Frozen observation and every sampled action remain in `fixtures/step4a-aa-59f950d.json`.
- Before changes: premium/context guards11PASS/4FAIL. The failure log is retained. After changes, this guard group14/14PASS; independent actual-combination/public-posterior checks6/6PASS; sequence fixture1/1PASS; probe legality/privacy2/2PASS. Together with frozen replay, targeted24/24PASS.
- Final paired AA and full benchmark:4/4PASS. Typecheck and lint PASS. This lane's final combined regression executed28/28PASS across7 files; it is not the full repository regression count.
- Complete hands:1920 across15 scripted-prefix families ×8 profiles ×2 models ×8 continuations;3072 across6 fixed probes ×8 profiles ×2 models ×32 hands;200 nine-handed ecology hands (100/model). Total5192 hands and22395 policy/probe decisions, excluding scripted-prefix actions. Every transition used the authoritative engine; every settlement reconciled starting money, final stacks, rake, paid contributions, refunds and awards.
- Runtime profiling (initial run): sequence candidate p50 7.79ms/p95 14.81ms/max55.90ms across3460 decisions. Probe candidate p50 .11ms/p95 12.74ms/max104.35ms across2905 decisions. This is Node with bounded caches and first-example diagnostic overhead, not browser performance certification.

Executable command: `STEP4B_REPORT_DIR=<directory> scripts/step4b-evaluate.sh`. The script also executes independent-model tests and writes one complete posterior vector. Compressed JSON reports and exact logs are in `evidence/`; `manifest.json` provides raw-content hashes. The original full result was retained before adding observational telemetry. Diagnostic reruns used the same runtime, seeds and outcomes. One initially mistaken test expected four public opponent actions; the actual prefix contains six (preflop call, flop check/call, turn check/call, river lead). The corrected expected count and original failed log are preserved; this was a test expectation defect.

## Exact AA result

Genuine unopened six-handed UTG,100BB, button0/SB1/BB2/actor3, only blind events, call1BB, minraise2BB. Same cards, observations,1000 action seeds/profile and numerical personality parameters. Only versioned identity changed. Every nonraise was an open limp; zero folds/checks/all-ins in either sample.

| Profile | Old raise / limp | New raise / limp |
|---|---:|---:|
| Nit |507 /493|955 /45|
| Station |271 /729|956 /44|
| TAG |962 /38|986 /14|
| LAG |958 /42|993 /7|
| Fit-or-fold |449 /551|963 /37|
| Maniac |924 /76|1000 /0|
| Passive regular |350 /650|935 /65|
| Stronger regular |963 /37|988 /12|

The old policy forced AA continuation but made ordinary raising mainly depend on aggression/skill. These were not misclassified defensive calls. New default value/trap behavior passes designed AA/KK guards. The guard frequencies are release choices, not measured human targets.

## Context and residuals

The new nine-handed sample was tighter:48 flops/100 and16 multiway flops, versus84 and53 in frozen1.0. New limps39, isolations17, squeezes3; every seat acted132–152 times. Conditional records include exact dealt classes, action counts, sizes and summed policy probabilities.

| Profile | New VPIP count/opportunities | Unopened actual entries / opportunities | Sum of conditional entry probabilities |
|---|---:|---:|---:|
| Nit |4/113|2/57|1.80|
| TAG |10/109|5/47|6.53|
| LAG |13/113|6/62|7.08|
| Stronger regular |12/110|6/51|6.51|
| Station |36/113|19/60|19.55|
| Maniac |31/106|19/54|17.22|

The nit unopened sample contained one AKo, one77 and no AA/KK/QQ/JJ/TT. This does not establish the profiles' long-run VPIP. LAG/TAG sampled totals overlap, but exhaustive designed100BB first-in range masses differ: LAG UTG15.28%/BTN32.88%, TAG9.48%/19.99%; nit5.31%/11.09%. Opening sizes were ordinary (~2.46BB nit,2.71 TAG,2.98 LAG,2.60 stronger). No action-sampler mismatch or uncontrolled size escalation was found. These intentionally tighter, hand-authored ranges still need external calibration.

All six exploit opponents were evaluated: minbet, hyper-overbet, limp-all, never-bluff, always-call and maximum aggression. Stronger-profile sample mean BB/hand was respectively−1.269,−1.584,+.075,+.188,+.239,−.582. Each32-hand approximate interval crosses0. Nit continued0/15 actual all-in opportunities (Wilson upper20.4%); fit0/16 (upper19.4%). Their apparently narrow negative P&L intervals describe blind-fold samples and cannot rule out rare profitable premium calls. Normal intervals explicitly warn about missing heavy-tail outcomes. Passive/station/maniac lost about13BB/hand against maximum aggression with very wide uncertainty. No assertion that every archetype beats simple probes, or that exploitability is low, is justified.

All profiles checked the declared missed-draw river in8/8 continuations. This is one blocker/line context, not proof of universal river passivity. Public aggressive-history bluffcatching increased versus passive-history in most paired profiles, but weak8-trial counts are not human estimates. Operational held-out cases used three paired/monotone river fixtures at35%/80%/180% prices. They were not tuned after inspection and are not a blinded human holdout. Other reserved card classes were not separately evaluated here.

## Completed-hand examples

`step4b-sequence:limped-sixway:4919296`, candidate TAG focus seat1: six players start20000c each, button0, SB1 posts100c, BB2 posts200c. Preflop seats3/4/5/0 call200c, seat1 completes100c, seat2 checks. All six check flop8h7d2c, turnQs and river3d. Seat0 shows3h2d for two pair and receives1200c. Ending stacks: seat0=21000c, all five others=19800c. Rake0, refunds0, total120000c conserved. Prefix limps were scripted; all eighteen postflop checks were model decisions.

`draw-completes-turn` TAG example:20000c each; seat0 raises preflop to600c, seat1 calls; seat1 bets flop600c, seat0 calls. TurnQh7h2c8h, seat1 checks; seat0 with AhKh bets1800c, seat1 folds. Engine refunds uncalled1800c and awards2400c. Final stacks21200c/18800c; paid4200−refund1800=award2400; rake0. The post-prefix turn bet/fold were model decisions.

## Acceptance evidence boundary

R03 has executed169/1326 class, position, action-node and actual weighting evidence; R05 has depth/SPR contexts; R08 has compatible nonzero normalized public ranges, update IDs and exact likelihood normalization; R10 has nonstandard prices and legal complete continuations; R15 has sparse two-observation uncertainty distinct from MC sample error. These support implementation portions only. R17 has full joint betting traces and declared prefixes, but no human joint-frequency match. R21 has all six probes and uncertainty, without proof of low exploitability. R23 has complete nine-handed bot ecology and opportunities, without calibrated population claims. R18/R19 human-reference validation and R20 validated external strategy references remain unsupported by this lane. Parent owns final acceptance status decisions, browser results, source preservation and deployment.
