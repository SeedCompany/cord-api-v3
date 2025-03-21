ARG NODE_VERSION=20
ARG NODE_IMAGE=public.ecr.aws/docker/library/node:${NODE_VERSION}-slim
ARG GEL_IMAGE=ghcr.io/geldata/gel:6

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

# Install Gel CLI for running migrations during deployment
RUN curl --proto '=https' --tlsv1.2 -sSf https://www.geldata.com/sh | sh -s -- -y --no-modify-path \
    && mv /root/.local/bin/gel /usr/local/bin/gel


# Apollo Rover CLI
RUN curl -sSL https://rover.apollo.dev/nix/latest | sh

# GraphQL Hive CLI
RUN curl -sSL https://graphql-hive.com/install.sh | sh

# Enable yarn via corepack
RUN corepack enable

FROM ${GEL_IMAGE} AS builder

# region Install NodeJS
ARG NODE_VERSION

RUN <<EOF
set -e

apt-get update

# Install necessary packages for downloading and verifying node repository info
apt-get install -y --no-install-recommends ca-certificates curl gnupg

# Download the node repository's GPG key and save it in the keyring directory
mkdir -p /etc/apt/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
# Add the node repository's source list with its GPG key for package verification
echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_VERSION}.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list

# Update again to recognize the new repository
apt-get update

apt-get install -y nodejs

# Enable yarn via corepack
corepack enable

EOF
# endregion

WORKDIR /source

ENV NODE_ENV=development \
    # Ignore creds during this build process
    GEL_SERVER_SECURITY=insecure_dev_mode \
    # Don't start/host the db server, just bootstrap & quit.
    GEL_SERVER_BOOTSTRAP_ONLY=1 \
    # Temporary until upstream stale default of "edgedb" is resolved
    GEL_SERVER_DATABASE=main \
    # Don't flood log with cache debug messages
    VERBOSE_YARN_LOG=discard

# Install dependencies (in separate docker layer from app code)
COPY .yarn .yarn
COPY package.json yarn.lock .yarnrc.yml ./
RUN yarn install --immutable

# Copy in application code
COPY ./dbschema /dbschema
COPY . .

# region Generate Gel TS/JS files
RUN <<EOF
set -e

chown -R gel:gel /dbschema src

# Hook `yarn gel:gen` into gel bootstrap.
# This allows it to be ran in parallel to the db server running without a daemon
mkdir -p /gel-bootstrap-late.d
printf "#!/usr/bin/env bash\ncd /source \nyarn gel:gen\n" > /gel-bootstrap-late.d/01-generate-js.sh
chmod +x /gel-bootstrap-late.d/01-generate-js.sh

# Bootstrap the db to apply migrations and then generate the TS/JS from that.
/usr/local/bin/docker-entrypoint.sh server
EOF
# endregion

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
