#!/bin/bash
# Tier 3 pre-push: one browser project, full chromium suite, rules and prod
# storage rules. No webkit, firefox, functions, or unit (Tier 1 covers them).
set -e -o pipefail

start=$SECONDS
DIST_INDEX=dist/lecoursville/browser/index.html

if [ ! -f "$DIST_INDEX" ] || [ -n "$(find src -type f -newer "$DIST_INDEX" -print -quit)" ]; then
  echo "=== [e2e:pr] Building e2e bundle ==="
  npx ng build --configuration=e2e
else
  echo "=== [e2e:pr] Reusing bundle newer than src ==="
fi

echo "=== [e2e:pr] Prod Storage rules pass ==="
PROD_CONFIG=$(node scripts/e2e/prod-rules-config.mjs)
firebase emulators:exec --project lecoursville-dev --config "$PROD_CONFIG" \
  --only auth,database,storage,hosting,functions \
  "node scripts/e2e/seed.mjs && npx playwright test --project=storage-prod"

echo "=== [e2e:pr] Rules + full chromium suite ==="
firebase emulators:exec --project lecoursville-dev \
  --only auth,database,storage,hosting,functions \
  "node scripts/e2e/seed.mjs && npx playwright test --project=rules && node scripts/e2e/seed.mjs && npx playwright test --project=chromium"

echo "=== [e2e:pr] finished in $((SECONDS - start))s ==="
