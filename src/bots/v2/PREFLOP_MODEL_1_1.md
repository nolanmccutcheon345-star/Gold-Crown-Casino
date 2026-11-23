# Designed preflop ranges 1.1.0

This is a synthetic behavioral model, not solver output, measured human ranges or equity. The immutable published Version 5 AA audit was completed before this policy was committed. The old policy remains unchanged in its version directory.

`PREFLOP_CLASSES` explicitly lists all 169 rank/suitedness classes with ordinal 0–100 scores. Each pair expands to 6 physical combinations, each suited class to 4 and each offsuit class to 12: 1,326 unique combinations. `rangeWeights` returns concrete continuation/raise/call weights per class. A range percentage must weight each class by its actual combination count; the 169 cells are not equally likely.

Physical positions are UTG/MP/CO/BTN/SB/BB, grouping additional early/middle seats at larger tables. The heads-up button is labeled BTN and is also the small blind. Six-handed seats immediately after BB are UTG, MP, CO, BTN. Roles depend on the original physical seats and button, not the number still contesting a pot.

Designed per-archetype positional cutoffs define underlying ranges. Smooth boundary weights support mixed play. The same 13 stable traits adjust position awareness, range width, price sensitivity, multiway caution, blocker aggression, sizing and deliberate traps. Explicit custom settings remain effective. The environmental offset is bounded; monetary stakes never assign skill.

Separate public action nodes cover unopened, limped/overlimped, facing an open, a three-bet and a four-bet+. Cold callers, squeeze opportunities, opener position and actual call price change the model. Every sizing outcome is a final raise-to total clamped to the authoritative legal action set. Closed raising cannot be reopened by this service.

Stack adjustments interpolate across 20, 40, 60, 100, 150, 200 and 300 BB anchors. Values above 300 BB retain the final modeled anchor; this is a declared model limit, not a table buy-in limit. Small pairs and suited connected hands lose speculative value shallow and gain it deeper, while dominated offsuit broadways lose relative value deep. Premium continuation and commitment use a continuous ordinal-value curve across the full class table rather than an `AA` action-frequency exception. Bounded slow-play probability is explicit and enters the premium initiative mixture.

`effectiveStackBB` includes current preflop street commitments when comparing the bot with the deepest active opponent. It therefore remains meaningful when an opponent has already moved its stack all-in. It is a multiway modeling convention, not a promise that every opponent covers that amount.

Prospective release guards registered before candidate evaluation: baseline nit AA/KK first-in raise >=90%, station/recreational >=80%, TAG/stronger-reg >=95%; early nit JTo entry <=half button entry. These are designed quality constraints, not empirical population frequencies. Custom extreme controls are outside those baseline guards. Separate tests cover QQ/AK value initiative, physical positions, legal action normalization, all class combination weights and stack interpolation.

Only permitted BotObservation and the actor's own profile enter this module. It reads no deck, other private cards/profiles or future board. Range hypotheses remain provisional and require independent sequence/equity/behavior evaluation. The table scores must never be displayed as percentages of equity, win rates or solver recommendations.
