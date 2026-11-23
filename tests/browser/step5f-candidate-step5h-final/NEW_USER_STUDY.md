# Three independent new users — standardized 25-hand study

**Current status: NOT_EXECUTED. No participants or outcomes are invented.** Recruit three real people who have never used this app. The same observer may conduct sessions, but one person repeating the task does not become three users. Use anonymous labels P1/P2/P3; record device and candidate identity. Agree on at least one actual narrow phone and one actual desktop across the study before recruitment. The actual iPhone/Safari physical check remains separately identified.

## Observer opening, read unchanged

“This is a virtual-money poker practice app under test. We are testing the interface, not your poker skill. Please say what you expect a control to do before using it, and tell us whenever wording or layout is unclear. You can stop at any time. I will observe rather than show you where each control is. We will record your actions and problems under an anonymous label.”

Obtain agreement for any screen/audio recording; otherwise use timestamped observation notes. Do not collect passwords, private production saves or contact details in the feedback files. Use only the isolated synthetic practice account. Supply the verified candidate URL; never substitute the public Version 7 URL.

## Tasks, without pointing to controls

1. Set up a $1/$2 cash table with the specified player count, $200 buy-in, one Unknown and at least two different selected archetypes. Explain whose turn it is and which seats post blinds.
2. On the first decision, locate and explain the **minimum raise**, **raise-to total**, **additional chips now** and **call amount**. Record answers verbatim before coaching; an incorrect answer is evidence. Record the displayed amounts and a screenshot/reference.
3. Choose a bet/raise size, predict its commitment and submit it. Where a legal opportunity naturally occurs, use a pot-sized proposal. Do not rig a hand or force a strategic choice solely to manufacture a pass.
4. Play **25 completed hands** through ordinary UI controls. Record every completed hand, intended versus actual action, misclick, rejection and ambiguity. Recognize actor/positions, community cards, all-in/side-pot displays where naturally encountered, and each payout. Record unavailable scenarios honestly; do not count an abandoned hand as complete.
5. During the same workflow, find history/replay and wallet editing; reload the same candidate URL and continue. Record recovery behavior. Manual adjustments must remain distinct from poker results.
6. End the session safely and explain the returned bankroll. Start another configuration, then find a past hand again. On mobile, record seat readability, control access, portrait/landscape and any horizontal scroll.

If the user cannot continue, ask only “What would you try next?” Record the blocker before offering help. Mark assistance with the exact prompt and timestamp; coached completion does not count as unassisted discovery. Do not explain raise-to semantics before the initial comprehension task.

## Per-hand and issue record

Use `hand-observation-form.csv` for all 75 actual hand rows, or the structured JSON template. Blank rows remain NOT_EXECUTED. Fill “0 misclicks” only when a real observer watched the hand; unobserved is not zero. Capture exact displayed minimum/total/additional/call amounts when applicable; use “not available in this state” with context when no raise/call opportunity exists. Link a redacted completed-history hand reference and observation artifact.

Severity: **critical** — money/state integrity, privacy leak or inability to safely recover; **major** — wrong/unintended action or blocked core task; **minor** — understandable but confusing or inconvenient presentation. Record intended result, actual result, exact steps, seat count, viewport, candidate build and evidence. Do not average away a critical defect.

## Review

Three distinct new users must each have 25 completed, actually observed hands. A reviewer checks the comprehension answers, assistance notes, misclicks and ambiguities against evidence. Repair reproducible defects, retain the original failures and rerun the affected task. Record each participant's outcome; a structurally complete form is not proof of independent participation or a passing V707. Simulated hands, internal agent clicks and an experienced developer's repeats cannot fill these rows.
