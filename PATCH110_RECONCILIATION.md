# Patch 110 — Seven-game feature compatibility checkpoint

**Status:** The uploaded author `Patch 103` is already included, unchanged in behavior, in the current Poker Night AI chain as **Patch 106** (`0060`). It is deliberately **not reapplied**.

## Previously integrated seven-game features

- Hold'em cash/tournament optional odds helper (no hidden information; Omaha excluded)
- Blackjack dealer bust probability and strategy comparison row
- Slots favorites and floor sorting
- Roulette Snake / Red splits / Black splits
- Craps working-on-come-out option
- Baccarat Player/Banker Dragon Bonus
- Racing Superfecta and boxed Exacta/Trifecta/Superfecta

## Integrity and application guidance

The submitted first ZIP's `0060-Patch-103-...patch` has a byte-identical **diff body** to the existing `0060-Patch-106-...patch` in the Patch 109 series. Only historical patch subject/header labeling differs. Applying it a second time would duplicate previously integrated code and is unsafe.

This Patch 110 is a continuity marker and review checkpoint. It intentionally changes no gameplay, balance, bot policy, UI code, or assets; keep the premium visual redesign from Patches 107–109 intact. Apply Patch 111 next for the *new* table-life work in the second ZIP.
