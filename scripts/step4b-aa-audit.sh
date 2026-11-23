#!/usr/bin/env bash
set -euo pipefail
# Replays the frozen Step4A observation/profile/seeds; no new policy tuning.
npm test -- tests/step4b/aa-baseline.test.ts --reporter=verbose
