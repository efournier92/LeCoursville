#!/bin/bash
# E2E gate: build the emulator-wired prod bundle, boot the Firebase Emulator
# Suite (auth, database, storage, hosting), seed deterministic data, and run
# the full Playwright matrix (chromium, webkit, firefox).
#
# Blocks deploys: scripts/deploy.sh runs this before any build/tag/deploy step.
set -e -o pipefail

mkdir -p .gate-results

echo "=== Building e2e bundle ==="
npx ng build --configuration=e2e

echo "=== Unit tests ==="
CI=true npm test -- --watch=false 2>&1 | tee .gate-results/unit-tests.txt

echo "=== Building functions ==="
npm --prefix functions ci --no-audit --no-fund
npm --prefix functions run build
echo "=== Functions tests ==="
npm --prefix functions test 2>&1 | tee .gate-results/functions-tests.txt

echo "=== Prod Storage rules pass ==="
# A throwaway config points the Storage emulator at storage.rules.prod so the
# gate exercises the deployed policy, not the open emulator rules.
PROD_CONFIG=$(node scripts/e2e/prod-rules-config.mjs)
firebase emulators:exec --project lecoursville-dev --config "$PROD_CONFIG" \
  --only auth,database,storage,hosting,functions \
  "node scripts/e2e/seed.mjs && npx playwright test --project=storage-prod"

echo "=== Starting emulators + seeding + running Playwright ==="
# A fresh emulator per browser project: the DB reseed alone is not enough
# because Storage objects and emulator process state persist across projects
# in one exec, and that accumulated state and load bleeds into late projects
# as intermittent timeouts. Rules and chromium share one exec, reseeded
# between them because the rules tests mutate DB state.
firebase emulators:exec --project lecoursville-dev \
  --only auth,database,storage,hosting,functions \
  "node scripts/e2e/seed.mjs && npx playwright test --project=rules && node scripts/e2e/seed.mjs && npx playwright test --project=chromium && cp test-results/e2e-results.json .gate-results/chromium.json"
firebase emulators:exec --project lecoursville-dev \
  --only auth,database,storage,hosting,functions \
  "node scripts/e2e/seed.mjs && npx playwright test --project=webkit && cp test-results/e2e-results.json .gate-results/webkit.json"
firebase emulators:exec --project lecoursville-dev \
  --only auth,database,storage,hosting,functions \
  "node scripts/e2e/seed.mjs && npx playwright test --project=firefox && cp test-results/e2e-results.json .gate-results/firefox.json"
