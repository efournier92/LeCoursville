#!/bin/bash
set -e

# Deploy LeCoursville
# Usage: ./deploy.sh <prod|dev>

deploy_prod() {
  echo "Deploying to production..."
  firebase use lecoursville
  firebase deploy
}

deploy_dev() {
  echo "Deploying to dev..."
  firebase use lecoursville-dev
  firebase deploy
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
    tag_build
    deploy_prod
    echo "=== Production deploy complete ==="
  elif [ "$ENV" = "dev" ]; then
    validate_dev_branch
    run_e2e_gate
    build_dev
    deploy_dev
    echo "=== Dev deploy complete ==="
  else
    echo "Usage: $0 <prod|dev>"
    exit 1
  fi
}

main "$@"