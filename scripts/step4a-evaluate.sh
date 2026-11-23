#!/usr/bin/env bash
set -euo pipefail
# Reproducible full experiment; artifacts are synthetic and contain no live user data.
STEP4A_EVALUATE=1 npm test -- tests/step4a/evaluate.test.ts --reporter=verbose
