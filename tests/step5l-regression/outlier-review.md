# Historical 10.072-second outlier: retained evidence review

**UNATTRIBUTED, not fixed. No new benchmark was executed for this review.**

The retained original report is `tests/step5b-resource/evidence/step5e-4ab9ea3/report.json`, SHA-256 `b23e8c176a665ebf7495133531135056082c989a821c8e43fd085b12816f8dec`. Its actual execution source is `6807744037d2de0ee2c298a9b097a7a4e09c51da`. The workload used Node 24.22.1, AMD EPYC 9V74, explicit GC and a 6,144 MiB V8 heap limit, with a segmented persistence reference. It did not render a browser UI.

The denominator **is preserved**: 69,055 preparations during 10,000 completed hands. Preparation p50/p95/p99/max were **5.926 / 27.385 / 40.589 / 10,072.242 ms**. Some later narrative reports incorrectly said the denominator was missing; the original aggregate is authoritative. What is missing is the individual sample trace and its context.

The largest policy call was 1,718.172 ms. Because this harness recorded one policy timing per preparation, the difference between aggregate maxima gives a lower bound of approximately **8,354.070 ms outside that one policy span** in the maximum preparation. It does not identify persistence, GC, memory pressure, host scheduling or another particular cause. The maxima are not paired timestamps.

The timed path wraps `await prepareBot()` and excludes the subsequent `commitBot()`. Explicit full-history audits and reloads run after completed hands, outside that preparation measurement. In-memory preparation/persistence work and scheduling could still contribute. Direct browser rendering cannot explain an event measured in this non-rendering Node harness.

The original report serialized aggregate quantiles and maximum, not the 69,055 raw durations. It preserves neither the maximum's hand/decision ID nor its timestamp, stack/pot/context, matching phase durations, contemporaneous CPU/GC trace, host-load trace or counts above one/five/ten seconds. Therefore the report proves at least one 10.072-second event but cannot establish an exact exceedance frequency or defensible future recurrence probability.

The original workload completed and its archive was independently reconciled. Those findings are compatible with a rare delay and do not show that a reload specifically during that maximum was safe. New current-source recovery/interruption tests must remain separately identified.

`outlier-review.json` records hashes and sizes for every retained original artifact, checks the original receipt/bundle/archive hashes against the prior independent resource review, and records the exact missing evidence. It also identifies the original assertion source by hash. No historical data was rewritten.

Future monitoring should retain redacted slow-decision context, timestamps, current history size, nested phase spans, GC/CPU anchors, exact source/version and recovery outcome. New peaks can be attributed from their own traces; they must not be substituted for this missing historical event. Do not remove financial verification or mask processing delays with think time.

This review does **not** by itself qualify Z14, physical-device performance, steady-state browser memory or release readiness.
