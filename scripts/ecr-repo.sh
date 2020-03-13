#!/usr/bin/env bash

set -e

REPO=cord-api-v3

AWS_ACCOUNT=${AWS_ACCOUNT:-$(aws sts get-caller-identity --query "Account" --output text 2> /dev/null || true)}
AWS_DEFAULT_REGION=${AWS_DEFAULT_REGION:-$(aws configure get region 2> /dev/null || true)}
if [ -n "$AWS_ACCOUNT" ] && [ -n "$AWS_DEFAULT_REGION" ]; then
  echo "${AWS_ACCOUNT}.dkr.ecr.${AWS_DEFAULT_REGION}.amazonaws.com/${REPO}"
else
  exit 1
fi
