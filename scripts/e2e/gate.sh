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

echo "=== Starting emulators + seeding + running Playwright ==="
# One fresh seed per browser project: the RTDB emulator state persists across
# projects in a single `playwright test` run, and mutation tests (chat edits,
# uploads, created records) would otherwise bleed into the next project's
# assertions. Re-seeding keeps every project deterministic.
firebase emulators:exec --project lecoursville-dev \
  --only auth,database,storage,hosting,functions \
  "node scripts/e2e/seed.mjs && npx playwright test --project=chromium && cp test-results/e2e-results.json .gate-results/chromium.json && node scripts/e2e/seed.mjs && npx playwright test --project=webkit && cp test-results/e2e-results.json .gate-results/webkit.json && node scripts/e2e/seed.mjs && npx playwright test --project=firefox && cp test-results/e2e-results.json .gate-results/firefox.json"
