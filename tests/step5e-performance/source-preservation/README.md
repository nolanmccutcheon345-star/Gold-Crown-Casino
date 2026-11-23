# Lossless diagnostic and executed-source preservation

The source host rejected the 41,482,386-byte compressed heap snapshot because a single Git file may not exceed 32 MiB. It was split into five parts of at most 8 MiB. No heap bytes, raw observations, assertions or production code were changed.

Only 13 unpublished commits whose ancestry contained that oversized blob were rewritten. The already-pushed ancestor `3cd08365c463402fdafd335375c14a80283afac2`, the full tested runtime `37aa22575baaf582f845a70e1862ba6e6409aa48`, and their test receipts are unchanged. `manifest.json` records the exact old/new mapping. Actual execution IDs in receipts were not retagged.

The original unpublished Git objects are preserved in a separate 6.2 MB pack, excluding only the oversized blob whose exact bytes are independently retained as parts. This makes the original source commits recoverable without pushing a file beyond the host limit. The original local ancestry also remains under `refs/step5e-preservation/original-before-artifact-split`.

Run from this checkout:

```sh
python tests/step5e-performance/source-preservation/restore.py
```

This read-only command verifies each part, the complete heap SHA-256, its original Git blob identity and the source-pack SHA-256. To restore original historical Git objects for `git show`, use:

```sh
python tests/step5e-performance/source-preservation/restore.py --git-dir .git
```

It adds original objects but does not move a branch or alter a working tree. The existing checkout must contain the recorded unchanged ancestor, as the saved project does. Use `--heap-output /explicit/new/path.heapsnapshot.gz` to reconstruct the original profiler file; an existing output is never overwritten. The original analysis JSON continues to describe the file and source actually measured.

The candidate remains **NOT READY FOR R1** and unpublished. This packaging adjustment does not constitute a new engine or browser test run.
