# Y10 cash-release scope decision

The original record is preserved verbatim:

- **Scenario:** “Bot-vs-bot six- and nine-handed ecology with churn, rebuy and mismatched stack depths”.
- **Acceptance:** “Humanly recognizable pot composition, raise size mix, multiway fraction and no frozen table/stack dynamics; assumptions documented.”
- Source: `docs/specs/V7_All_302_Acceptance_Tests.txt`, lines722–724.

Churn is therefore part of the original full scenario. It is not invented and the whole original row stays **NOT_EXECUTED** while that functionality remains absent. Governing V7 Master section9 explicitly keeps the86 deferred entries out of R1 blocking scope. **FUT032 Dynamic field ecology** says “Players leave/rebuy/move, table changes and skill mixtures with explicit distributions”, depends on the R1 seat manager, and remains **DEFERRED_NOT_IMPLEMENTED**, R4 human simulation. The canonical Y10 row already distinguished fixed six/nine-handed population/depth behavior (R1) from automatic turnover/churn (FUT032) before this decision.

The executable R1 check may therefore use a separately recorded **cash-component PASS** while the whole original criterion remains NOT_EXECUTED. This does not introduce a new feature deferral, remove a requirement, alter original wording or add an original PASS. It implements the existing governing scope separation after executing its required cash evidence.

## Executed cash coverage

`evidence/full-c409bab/Y10-ecology.json` and its16 full-hand archives record800 continuous cash hands,9,169 legal actions and55 top-ups through the authoritative engine. There are two populations (six and nine seats), eight independent50-hand blocks each, stable identities and public observations, and25/40/65/100/150/200BB starting depths. Stacks carry forward exactly; dealer position changes; real independent wallet debits fund between-hand top-ups. Independent per-hand and session wallet/table/rake reconciliation passed. Every block has50 distinct starting-stack states, so neither stack movement nor rebuy dynamics is a frozen per-hand reset.

Pot composition and multiway behavior are observed, not asserted from labels:99/217 flops multiway at six seats and141/229 at nine seats; nine-player play includes an actual side pot. Limp/raise/3-bet opportunities and raise-size buckets are recorded. Six complete hands were independently inspected using predetermined selection rules, including checked-down showdowns, fold endings, full-house slow play/value line, large preflop escalation and a three-player side-pot hand. All records and unusual recreational decisions are retained. The study assumptions, sparse river samples and absence of measured human calibration are explicit in `RESULTS.md`.

The exact acceptance wording does **not** require a named human expert or independent human calibration dataset. The user's Step5A/5C instructions explicitly permit a coherent synthetic opponent system for R1 while forbidding false expert/human-calibration claims. Engineering inspection of complete sequences plus the documented functional measurements supports this cash-component criterion; it is not a certification of human resemblance or optimal strategy. Requiring human expert signoff here would add a gate not present in this original cash criterion. Other explicit human, device and calibration requirements remain unchanged.

## Recorded outcomes

- Original Y10 status: **NOT_EXECUTED**.
- Explicit governed cash component: **PASS**.
- Deferred FUT032: unchanged, **DEFERRED_NOT_IMPLEMENTED**.
- No named expert, physical-device, human-calibration or solver claim.
- Original302-status totals do not change. Verified explicit cash components increase from8 to9; unresolved R1 checks decrease from12 to11.
