#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: tools/deploy/build-and-push.sh <aws-region> <api-ecr-repo> <web-ecr-repo> [tag]

Arguments:
  aws-region     AWS region where the ECR repositories live (e.g. us-east-1).
  api-ecr-repo   Fully qualified ECR repo for the API (e.g. 123456789012.dkr.ecr.us-east-1.amazonaws.com/ddms-api).
  web-ecr-repo   Fully qualified ECR repo for the web app (e.g. 123456789012.dkr.ecr.us-east-1.amazonaws.com/ddms-web).
  tag            Optional image tag to build and push (default: latest).

Prerequisites:
  - AWS CLI v2 configured with permissions for ECR.
  - Docker daemon running on this machine.
  - corepack (or pnpm) available for the Dockerfiles to execute.
USAGE
}

if [[ ${1:-} == "-h" || ${1:-} == "--help" ]]; then
  usage
  exit 0
fi

if [[ $# -lt 3 || $# -gt 4 ]]; then
  usage
  exit 1
fi

AWS_REGION=$1
API_ECR_REPO=$2
WEB_ECR_REPO=$3
IMAGE_TAG=${4:-latest}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Error: required command '$1' not found in PATH." >&2
    exit 1
  fi
}

require_cmd aws
require_cmd docker

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd "$SCRIPT_DIR/../.." && pwd)

login_registry() {
  local registry=$1
  echo "Logging into ECR registry ${registry}..."
  aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$registry"
}

extract_registry() {
  printf '%s\n' "$1" | cut -d/ -f1
}

API_REGISTRY=$(extract_registry "$API_ECR_REPO")
WEB_REGISTRY=$(extract_registry "$WEB_ECR_REPO")

if [[ "$API_REGISTRY" == "$WEB_REGISTRY" ]]; then
  login_registry "$API_REGISTRY"
else
  login_registry "$API_REGISTRY"
  login_registry "$WEB_REGISTRY"
fi

echo "Building API image (tag: ${IMAGE_TAG})..."
docker build \
  -f "$REPO_ROOT/apps/api/Dockerfile" \
  -t "ddms-api:${IMAGE_TAG}" \
  --platform linux/amd64 \
  "$REPO_ROOT"

echo "Tagging API image for ${API_ECR_REPO}:${IMAGE_TAG}..."
docker tag "ddms-api:${IMAGE_TAG}" "${API_ECR_REPO}:${IMAGE_TAG}"

echo "Pushing API image to ${API_ECR_REPO}:${IMAGE_TAG}..."
docker push "${API_ECR_REPO}:${IMAGE_TAG}"

echo "Building web image (tag: ${IMAGE_TAG})..."
docker build \
  -f "$REPO_ROOT/apps/web/Dockerfile" \
  -t "ddms-web:${IMAGE_TAG}" \
  --platform linux/amd64 \
  "$REPO_ROOT"

echo "Tagging web image for ${WEB_ECR_REPO}:${IMAGE_TAG}..."
docker tag "ddms-web:${IMAGE_TAG}" "${WEB_ECR_REPO}:${IMAGE_TAG}"

echo "Pushing web image to ${WEB_ECR_REPO}:${IMAGE_TAG}..."
docker push "${WEB_ECR_REPO}:${IMAGE_TAG}"

cat <<EOF
Build and push complete.
- API image: ${API_ECR_REPO}:${IMAGE_TAG}
- Web image: ${WEB_ECR_REPO}:${IMAGE_TAG}
EOF
