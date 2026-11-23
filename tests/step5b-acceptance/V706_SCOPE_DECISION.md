# V706: original criterion retained; R1 straddle clause explicitly deferred

Decision version `step5b-scope-v706-1`, based on the governing V7 permanent
directive, not a change to the original acceptance requirement.

The original V706 criterion remains unchanged:

> Change rake/blinds/straddle/denomination with active action; settled hand uses original version, next hand new version, ledger/hand replay consistent.

V7 Master section9, “Deferred features never forgotten,” explicitly includes
straddles and states “They are NOT R1 blockers. Implement only after relevant
game authority and validations exist.” The following precedence paragraph makes
the V7 directive and explicitly cited patches superior to conflicting V6 wording.
See preserved `docs/specs/V7_Master.txt`, lines503–516, and the hash-verified
authoritative PDF. The implementation prompt's broader straddle wording and
V706 remain preserved for later complete acceptance.

FUT010 and FUT011 independently preserve Mississippi/multiple straddle variants.
Those two entries alone would **not** justify deferring a basic straddle, since
both depend on a straddle base. The governing section9 statement is the explicit
authority for this R1 split; no unsupported inference from the future list is used.

The whole original V706 status is **NOT_EXECUTED** until the straddle clause is
implemented and tested. The R1 release gate separately requires executed evidence
for every supported cash clause: an active hand keeps its original rake, blinds,
denomination and rule-profile version; a queued change applies a new version only
to the next hand; ledger and immutable replay remain consistent. This component
is **NOT_EXECUTED** until its final integrated browser evidence is recorded.

This decision does not waive cash editing, freezing, profile identity, denomination,
accounting or history verification. It adds no original requirement ID and does
not turn a component PASS into a passed original acceptance requirement. All86
future features, includingFUT010/FUT011, remain unchanged.
