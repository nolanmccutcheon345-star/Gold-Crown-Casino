# Eliminated-Hero bot preparation regression

Before the fix, `npx vitest run tests/tournament-runtime/eliminated-bots.test.ts` executed one test and failed with `Invalid seat position.` (655 ms test duration). It reconstructs an actual canonical completed-hand prefix from immutable event fixtures, calls the authoritative next-hand function to create a hand with an empty physical dealer position, restores the isolated controller, and calls the real decision policy. Hero is no longer seated.

Cause: the cash policy's preflop position calculation required the button to be an occupied seat. Tournament dead-button rules legitimately permit an empty dealer position. The root UI's attempt to commit a token without a prepared decision masked the original error as `Prepare the tournament bot decision first`.

The regression requires successful real policy preparation, identical pending-decision restoration, and exactly one revision increment per commit for up to ten actions or the completed hand. It does not replace real bot decisions with forced test actions.

After engine/policy fix `e460b02`, all 16 runtime tests passed with zero failures or skips; this regression passed in 1,660.64 ms. Exact results are in `results.json`. Typecheck and focused lint passed. The fixed UI scheduler additionally requires a prepared decision before commitment (parent-owned change).
