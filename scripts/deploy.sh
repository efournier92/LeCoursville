#!/bin/bash
set -e

# Deploy LeCoursville
# Usage: ./deploy.sh <prod|dev>

# Hosting is the ONLY Firebase target this repo deploys. Never use a bare
# `firebase deploy` here: firebase.json also wires `storage.rules` for the
# storage emulator, and that file is deliberately open (`allow read, write:
# if true`) so the e2e gate can seed fixtures. A bare deploy ships it and
# overwrites the real rules in the Firebase console with an open bucket.
deploy_prod() {
  echo "Deploying to production..."
  firebase use lecoursville
  firebase deploy --only hosting
}

deploy_dev() {
  echo "Deploying to dev..."
  firebase use lecoursville-dev
  firebase deploy --only hosting
}

build_prod() {
  echo "Building for production..."
  npx ng build --configuration=production
}

build_dev() {
  echo "Building for dev..."
  npx ng build --configuration=development
}

tag_build() {
  echo "Tagging build..."
  TAG=$(date +%y.%m.%d)
  echo "Tagging as $TAG..."
  git tag $TAG
  git push origin $TAG
}

validate_prod_branch() {
  echo "=== Validating branch for production deploy ==="
  BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || git rev-parse --short HEAD)
  if [ "$BRANCH" != "master" ]; then
    echo "ERROR: Deploying from '$BRANCH' branch. Only 'master' is allowed for production deploys."
    exit 1
  fi
  echo "On master branch. Proceeding..."
}

validate_dev_branch() {
  echo "=== Validating branch for dev deploy ==="
  BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || git rev-parse --short HEAD)
  if [ "$BRANCH" != "master" ] && [ "$BRANCH" != "file-upload-polishes" ]; then
    echo "WARNING: Deploying from '$BRANCH' branch."
  fi
  echo "Proceeding..."
}

# Every file under src/environments/ is gitignored and read at BUILD time, so a
# local config swap can produce a bundle wired to the wrong Firebase project.
# That has happened: a prod-configured bundle was deployed to the dev site, which
# showed up as auth/invalid-continue-uri and quietly pointed dev testing at the
# production database. Assert the built bundle's identity before tagging or
# deploying, and fail loudly instead.
validate_bundle_config() {
  local env=$1
  local pub_dir=""
  for candidate in dist/lecoursville/browser dist/lecoursville; do
    if [ -d "$candidate" ]; then
      pub_dir="$candidate"
      break
    fi
  done
  if [ -z "$pub_dir" ]; then
    echo "ERROR: no build output found (looked in dist/lecoursville/browser and dist/lecoursville)."
    exit 1
  fi

  local expect_domain expect_db other_domain other_db
  if [ "$env" = "prod" ]; then
    expect_domain="lecoursville.firebaseapp.com"
    expect_db="lecoursville.firebaseio.com"
    other_domain="lecoursville-dev.firebaseapp.com"
    other_db="lecoursville-dev-default-rtdb"
  else
    expect_domain="lecoursville-dev.firebaseapp.com"
    expect_db="lecoursville-dev-default-rtdb"
    other_domain="lecoursville.firebaseapp.com"
    other_db="lecoursville.firebaseio.com"
  fi

  echo "=== Checking built bundle identity ($env) ==="
  if ! grep -rq --include='*.js' "$expect_domain" "$pub_dir" || ! grep -rq --include='*.js' "$expect_db" "$pub_dir"; then
    echo "ERROR: building for '$env' but the bundle has no $expect_domain / $expect_db."
    echo "Check src/environments/environment.ts (gitignored; read at build time) and rebuild."
    exit 1
  fi
  if grep -rq --include='*.js' "$other_domain" "$pub_dir" || grep -rq --include='*.js' "$other_db" "$pub_dir"; then
    echo "ERROR: building for '$env' but the bundle contains the other project's config"
    echo "       ($other_domain / $other_db). Refusing to deploy across projects."
    exit 1
  fi
  echo "Bundle identity OK: $env config in $pub_dir"
}

run_e2e_gate() {
  echo "=== Running e2e gate ==="
  npm run e2e:gate
  local exit_code=$?
  if [ $exit_code -ne 0 ]; then
    echo ""
    echo "E2E gate FAILED. Do not deploy."
    echo "Artifacts for the fix loop: test-results/e2e-results.json (JSON), playwright-report/index.html (HTML), test-results/ (traces, screenshots, videos)."
    echo "Start a session and say: fix the e2e gate. Drive the loop in 'Failure fix loop' below; re-run 'npm run e2e:gate' until green, then deploy again."
    exit $exit_code
  fi
  sign_off
}

sign_off() {
  if [ ! -t 0 ]; then
    if [ "$E2E_APPROVED" = "1" ]; then
      return
    fi
    echo "ERROR: non-interactive shell cannot sign off. Re-run interactively or set E2E_APPROVED=1 to approve the gate result."
    exit 1
  fi
  echo ""
  echo "=== E2E gate PASSED (chromium, webkit, firefox) ==="
  echo "Review the report: open playwright-report/index.html"
  printf 'Type "deploy" to approve and continue, anything else to abort: '
  read -r approval
  if [ "$approval" != "deploy" ]; then
    echo "Deploy aborted by user (gate was green; no deploy action ran)."
    exit 1
  fi
}

main() {
  ENV=${1:-prod}

  if [ "$ENV" = "prod" ]; then
    validate_prod_branch
    run_e2e_gate
    build_prod
    validate_bundle_config prod
    tag_build
    deploy_prod
    echo "=== Production deploy complete ==="
  elif [ "$ENV" = "dev" ]; then
    validate_dev_branch
    run_e2e_gate
    build_dev
    validate_bundle_config dev
    deploy_dev
    echo "=== Dev deploy complete ==="
  else
    echo "Usage: $0 <prod|dev>"
    exit 1
  fi
}

main "$@"