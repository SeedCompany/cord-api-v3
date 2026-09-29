ARG NODE_VERSION=24.14.1
ARG NODE_IMAGE=public.ecr.aws/docker/library/node:${NODE_VERSION}-slim

FROM ${NODE_IMAGE} AS base-runtime

# Install these native packages
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
      # wget/curl for health checks
      ca-certificates wget curl \
      # Install ffprobe from here, as the npm version is manually published and as of comment segfaults with urls
      ffmpeg \
    # Clean up cache to reduce image size
    && apt-get clean -q -y \
    && rm -rf /var/lib/apt/lists/*

# Apollo Rover CLI
RUN curl -sSL https://rover.apollo.dev/nix/latest | sh

# GraphQL Hive CLI
RUN curl -sSL https://graphql-hive.com/install.sh | sh

# Enable yarn via corepack
RUN corepack enable

FROM ${NODE_IMAGE} AS builder

# Enable yarn via corepack
RUN corepack enable

ENV NODE_ENV=development \
    # Don't flood log with cache debug messages
    VERBOSE_YARN_LOG=discard

WORKDIR /source

# Install dependencies (in separate docker layer from app code)
COPY .yarn .yarn
COPY package.json yarn.lock .yarnrc.yml ./
RUN yarn install --immutable

# Copy in application code
COPY . .

# Build server
RUN yarn build

# Generate GraphQL schema
RUN yarn start -- --gen-schema

# Remove non-production files
RUN rm -rf nest-cli.json tsconfig* test
# Remove dev dependencies
RUN yarn workspaces focus --all --production
# Remove yarn cache to reduce image size
RUN yarn cache clean --all

FROM base-runtime AS runtime

WORKDIR /opt/cord-api

# Copy built files from builder stage to this runtime stage
COPY --from=builder /source /opt/cord-api

# Cache current yarn version
RUN corepack install

# Grab latest timezone data
RUN mkdir -p .cache && \
    curl -o .cache/timezones https://raw.githubusercontent.com/moment/moment-timezone/master/data/meta/latest.json

LABEL org.opencontainers.image.title="CORD API"
LABEL org.opencontainers.image.vendor="Seed Company"
LABEL org.opencontainers.image.source=https://github.com/SeedCompany/cord-api-v3
LABEL org.opencontainers.image.licenses="MIT"

ENV NODE_ENV=production PORT=80

EXPOSE 80

CMD ["yarn", "start:prod"]

ARG GIT_HASH
ARG GIT_BRANCH
RUN echo GIT_HASH=$GIT_HASH > .env
RUN echo GIT_BRANCH=$GIT_BRANCH >> .env
