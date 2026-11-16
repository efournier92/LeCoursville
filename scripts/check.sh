#!/bin/bash
# Tier 1 dev loop: static checks, e2e bundle build, and the unit suite.
# No emulators, no browsers, no functions install. Fail-fast.
set -e -o pipefail

start=$SECONDS

echo "=== [check] Theme standardization ==="
node scripts/check-theme-standardization.mjs

echo "=== [check] PII canary ==="
node scripts/check-pii-canary.mjs

echo "=== [check] Building e2e bundle ==="
npx ng build --configuration=e2e

echo "=== [check] Unit tests ==="
CI=true npm test -- --watch=false

echo "=== [check] PASSED in $((SECONDS - start))s ==="
