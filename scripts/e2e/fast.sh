#!/bin/bash
# Tier 2 single-change loop: one emulator boot, chromium only.
# Args pass through to `playwright test` verbatim:
#   npm run e2e:fast -- e2e/specs/people.spec.ts
#   npm run e2e:fast -- -g "some test name"
#   npm run e2e:fast -- --last-failed
set -e -o pipefail

start=$SECONDS
DIST_INDEX=dist/lecoursville/browser/index.html

if [ ! -f "$DIST_INDEX" ] || [ -n "$(find src -type f -newer "$DIST_INDEX" -print -quit)" ]; then
  echo "=== [e2e:fast] Building e2e bundle ==="
  npx ng build --configuration=e2e
else
  echo "=== [e2e:fast] Reusing bundle newer than src ==="
fi

# Default reruns only the last failures. Without a recorded failed set
# `--last-failed` selects nothing and exits green, so fall back to the full suite.
if [ $# -eq 0 ]; then
  if node -e 'const f=require("./test-results/.last-run.json");process.exit((f.failedTests||[]).length?0:1)' 2>/dev/null; then
    ARGS=(--last-failed)
  else
    echo "=== [e2e:fast] No recorded failures, running full chromium suite ==="
    ARGS=()
  fi
else
  ARGS=("$@")
fi

INNER="npx playwright test --project=chromium $(printf '%q ' "${ARGS[@]}")"
echo "=== [e2e:fast] $INNER ==="

firebase emulators:exec --project lecoursville-dev \
  --only auth,database,storage,hosting,functions \
  "node scripts/e2e/seed.mjs && $INNER"

echo "=== [e2e:fast] finished in $((SECONDS - start))s ==="
