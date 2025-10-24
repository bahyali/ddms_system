#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: tools/deploy/rollout.sh <aws-region> <cluster-name> <api-service-name> <web-service-name>

Arguments:
  aws-region        AWS region containing the ECS cluster (e.g. us-east-1).
  cluster-name      Name of the ECS cluster created by Terraform.
  api-service-name  ECS service name for the API task.
  web-service-name  ECS service name for the web task (use "-" to skip).

The script triggers a new deployment for each service so ECS pulls the latest
image tag configured on the task definition (defaults to "latest").

Prerequisites:
  - AWS CLI v2 configured with permissions to update ECS services.
USAGE
}

if [[ ${1:-} == "-h" || ${1:-} == "--help" ]]; then
  usage
  exit 0
fi

if [[ $# -ne 4 ]]; then
  usage
  exit 1
fi

AWS_REGION=$1
CLUSTER_NAME=$2
API_SERVICE=$3
WEB_SERVICE=$4

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Error: required command '$1' not found in PATH." >&2
    exit 1
  fi
}

require_cmd aws

echo "Forcing new deployment for API service '${API_SERVICE}' in cluster '${CLUSTER_NAME}' (${AWS_REGION})..."
aws ecs update-service \
  --cluster "$CLUSTER_NAME" \
  --service "$API_SERVICE" \
  --force-new-deployment \
  --region "$AWS_REGION" \
  >/dev/null

if [[ "$WEB_SERVICE" != "-" ]]; then
  echo "Forcing new deployment for web service '${WEB_SERVICE}'..."
  aws ecs update-service \
    --cluster "$CLUSTER_NAME" \
    --service "$WEB_SERVICE" \
    --force-new-deployment \
    --region "$AWS_REGION" \
    >/dev/null
else
  echo "Skipping web service deployment."
fi

echo "Deployment(s) triggered. Monitor progress via 'aws ecs describe-services' or the AWS console."
