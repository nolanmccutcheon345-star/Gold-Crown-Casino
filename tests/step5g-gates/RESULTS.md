# Step5G local release-evidence fixes

V522 is now **BLOCKED** in the sole mutable acceptance registry, pending the user's future GitHub connection. Development and local verification continue. The exact original criterion, its ID and release-critical scope are unchanged. The new [dependency record](hosted-ci-dependency.json) explicitly contains no hosted run URL or claimed execution.

The dashboard previously described the Step5E source's 229/237 qualification as “current” even after newer runtime changes. It now identifies the exact historical source and keeps that qualification separate from fresh regression and criterion mapping. The read-only snapshot accepts legitimate current status updates while retaining the frozen historical status separately; it still rejects original criterion/ID changes and never turns an automated test count into a requirement PASS. Blocked rows are now included in the unresolved original-criterion table. The local receipt runner accepts a new Step5G evidence directory without permitting source-tree or traversal writes.

Executed from source `0f9d2f12936f2a9148af5d3ffe895f53a73587a1`:

| Check | Result |
|---|---|
| Registry, R1 release, and new dependency boundaries | 33/33 PASS |
| Receipt, workflow and runner contracts | 59/59 PASS |
| Independent pricing, PokerKit and metamorphic mechanics | 30/30 PASS |
| Typecheck and focused lint | PASS |
| Original specification hashes and generated dashboard | PASS |

The three groups are separate test executions; none is an additional mapped V7 acceptance PASS. The first typecheck caught two undeclared JS-module imports in the new test. The test now calls the real CLI, and the final typecheck and regression passed. PokerKit emitted its existing warning about an unnecessary fold in a reference fixture; all comparison assertions passed.

[Source-bound local execution record](evidence/execution.json) records the exact commands, result hashes and unchanged runtime inventory. Full integrated regression, a new compiled build and browser testing belong to the integrating workstream. No Site or other project was accessed by this lane.

All302 original requirements and86 deferred features remain intact. Current original statuses are **221 PASS,0 FAIL,6 BLOCKED,75 NOT_EXECUTED**. The only status change is V522: NOT_EXECUTED → BLOCKED. Historical reports retain their original counts.

The eight historically unresolved mandatory gates remain U10,U11,U16,Z02,Z14,V518,V522,V707. Actual screen-reader, physical-device and three independent25-hand user tests remain external evidence needs. U16/Z02 require complete historical project-write provenance; local files cannot fabricate that proof. Z14 requires fresh cash-workflow, bounded-storage and performance qualification; its explicitly deferred mixed scope remains intact. V706 remains whole NOT_EXECUTED with its supported cash component separately PASS. **NOT READY FOR R1.**
