#!/usr/bin/env bash
set -euo pipefail
# Full sample counts may be explicitly reduced for runtime budgets; JSON records actual N.
STEP4B_EVALUATE=1 npm test -- tests/step4b --reporter=verbose
