# Before-fix quiet-clock investigation

`probe.ts` was executed against source checkpoint
`03abe44462b48877f95d722c2efd4ee094ce2206`, whose controller/UI runtime matches
`72ee5357f6d2aeac2c03d1c176e4ef3bdc12a913`. `result.json` binds the exact two
production files by SHA-256 and records the observed output.

Run at that checkpoint:

```sh
node_modules/.bin/vite-node tests/step5e-independent/quiet-clock-before/probe.ts
```

This diagnostic intentionally asserts the **pre-fix defect** and is not included
in the normal `*.test.ts` regression suite. It uses the real production controller
and a held persistence acknowledgement. It does not claim DOM or browser execution.

After a completed hand, `tick()` starts a quiet write and sets `busy=true` without
publishing its busy-start state. The last subscriber state still says `busy=false`.
A `nextHand()` request during that interval returns with no error and unchanged
hand/revision. Clock completion publishes ready, but never retries the request.
Calling `nextHand()` again afterward succeeds. The UI guards in `nextHand()` and
`run()` likewise silently return when the controller is busy, so an enabled control
rendered before a quiet write can reject an otherwise valid click.

`browser-failure-analysis.json` separately extracts actual reports 364–369 from
the first ten-seat stress failure and binds the source artifact by SHA-256:

- Report365 completes `hand-47398b7ad5793cdf54104ea56f059e1f` as saved hand98.
- Report366 records a `#next-hand` click but returns that same hand ID.
- Report367 reports the same completed hand, with zero Hero actions and still98
  saved hands. The harness counted it as another loop iteration.
- Final accounting correctly contains99 hands and99 settlements; no chip mismatch
  or duplicate payout was observed.

The browser artifact does **not** record `controller.busy` at the failed click.
It proves the missed transition and duplicate QA count, while the separate
production diagnostic proves a matching lost-request mechanism. It does not prove
that the quiet-clock mechanism caused that particular browser click. Both issues
must be distinguished from a financial-accounting failure.
