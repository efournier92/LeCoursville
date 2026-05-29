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

main() {
  ENV=${1:-prod}

  if [ "$ENV" = "prod" ]; then
    validate_prod_branch
    build_prod
    tag_build
    deploy_prod
    echo "=== Production deploy complete ==="
  elif [ "$ENV" = "dev" ]; then
    validate_dev_branch
    build_dev
    deploy_dev
    echo "=== Dev deploy complete ==="
  else
    echo "Usage: $0 <prod|dev>"
    exit 1
  fi
}

main "$@"