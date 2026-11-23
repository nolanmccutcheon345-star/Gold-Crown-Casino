#!/usr/bin/env bash
set -euo pipefail
STEP4C_EVALUATE=1 node node_modules/vitest/vitest.mjs run tests/step4c/execute.test.ts --reporter=verbose
