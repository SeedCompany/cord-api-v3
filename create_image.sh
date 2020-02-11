#!/usr/bin/env bash

echo REPO="$REPO"
echo ACCOUNT_NUMBER="$ACCOUNT_NUMBER"
echo AWS_DEFAULT_REGION="$AWS_DEFAULT_REGION"
echo PROFILE="$PROFILE"

echo aws ecr create-repository --repository-name "$REPO" --profile "$PROFILE"
aws ecr create-repository --repository-name "$REPO" --profile "$PROFILE"

echo docker build -t "$ACCOUNT_NUMBER".dkr.ecr."$AWS_DEFAULT_REGION".amazonaws.com/"$REPO" .
docker build -t "$ACCOUNT_NUMBER".dkr.ecr."$AWS_DEFAULT_REGION".amazonaws.com/"$REPO" .

echo aws ecr get-login --no-include-email --profile $PROFILE
$(aws ecr get-login --no-include-email --profile $PROFILE)

echo docker push "$ACCOUNT_NUMBER".dkr.ecr."$AWS_DEFAULT_REGION".amazonaws.com/"$REPO"
docker push "$ACCOUNT_NUMBER".dkr.ecr."$AWS_DEFAULT_REGION".amazonaws.com/"$REPO"