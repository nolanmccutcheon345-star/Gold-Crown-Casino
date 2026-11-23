# F10 original-criterion review

Original ID and wording retained: **F10 — Strong reg adjusts size/line more accurately on average; avoid unconditional ‘always best’ claims.**

The integrated candidate `fed76a93d45a387e87e1299bc78f8ece454e9775` executed the frozen held-out protocol without a policy change: 49,152 legal decisions, 192 situations, 576 board/line/depth/range cells, four stable identities per archetype and 32 paired draws per identity. Evidence: `TEST_EVIDENCE/step5d/release-repaired/river/F10-heldout.json.gz` and the source/build-pinned execution manifest in its parent directory.

The stronger regular's mean advantage over the weak recreational profile was **343.987844 cents of stipulated one-node utility**. The descriptive twelve-board-family bootstrap interval was **[169.280968, 556.083989] cents**. All three range aggregates, four action-context aggregates and both stack-depth aggregates were positive. All outcomes remain included: 454 positive cells, 101 negative cells, 21 ties; the broadway-four-straight family averaged **−4.626681 cents**, and the trips rank aggregate **−123.837656 cents**. These exceptions are material and prohibit an unconditional superiority claim.

Independent reference review cross-checked 23,760 compatible opponent comparisons against pinned PokerKit 0.7.7 and counted zero folds in 5,376 priced unlosable-holding opportunities. Those reference checks use the earlier frozen diagnostic artifact; the fresh integrated diagnostic retained the same deterministic outcomes. The engine, policy and fixtures were not tuned to the resulting scores.

**Decision: PASS for this bounded synthetic acceptance criterion.** The positive mean is a reviewed outcome, not a test's assumed assertion. This is not expert assessment, measured-human calibration, solver validation, full decision EV or proof of real-world profitability. The reference response model omits re-raises and other future strategic adaptation. The earlier 0/30 oversized-pressure finding remains a documented research finding and was not repaired by forcing arbitrary call quotas.

This closes one original acceptance ID. It does not close the remaining device, hosted-CI, release-provenance or large-history performance requirements.
