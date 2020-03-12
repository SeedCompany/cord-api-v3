#!/usr/bin/env bash
# Builds docker images for both dev and production targets.
# Both builds will have "local" repo and ecr repo if AWS info can be identified.
# Prod build will be tagged with `latest` or based on TAG env var
# which can be one or more tags separated by comma or space.
# Dev build will always only get the `dev` tag

set -e

REPO=cord-api-v3
IFS=', ' read -ra TAGS <<< "${TAG:-latest}"

REPOS=( "$REPO" )

# Add ECR repo if it can be identified
AWS_ACCOUNT=${AWS_ACCOUNT:-$(aws sts get-caller-identity --query "Account" --output text 2> /dev/null || true)}
AWS_DEFAULT_REGION=${AWS_DEFAULT_REGION:-$(aws configure get region 2> /dev/null || true)}
if [ -n "$AWS_ACCOUNT" ] && [ -n "$AWS_DEFAULT_REGION" ]; then
  ECR_REPO=${AWS_ACCOUNT}.dkr.ecr.${AWS_DEFAULT_REGION}.amazonaws.com/${REPO}
  REPOS+=( "$ECR_REPO" )
fi

function join_by { local IFS="$1"; shift; echo "$*"; }
function tag_args {
    local args=()
    for r in ${REPOS[*]}; do
      for t in "$@"; do
        args+=( "-t $r:$t" )
      done
    done
    join_by ' ' "${args[@]}"
}

# Merge repos and tags together for docker build tag args
PROD_TAGS=$(tag_args "${TAGS[@]}")
DEV_TAGS=$(tag_args dev)

set -ex # Echo docker commands on output

docker build $DEV_TAGS --target=dev . "$@"
docker build $PROD_TAGS . "$@"
