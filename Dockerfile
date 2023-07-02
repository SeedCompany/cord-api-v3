ARG NODE_VERSION=18

FROM public.ecr.aws/docker/library/node:${NODE_VERSION}-slim as node

# Install wget curl
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
      ca-certificates wget curl \
    &&  apt-get clean -q -y \
    && rm -rf /var/lib/apt/lists/*

# Install EdgeDB CLI
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.edgedb.com | sh -s -- -y --no-modify-path \
    && mv /root/.local/bin/edgedb /usr/local/bin/edgedb

FROM ghcr.io/edgedb/edgedb:3 as builder

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl

# Install NodeJS & Yarn
ARG NODE_VERSION
RUN curl -fsSL https://deb.nodesource.com/setup_$NODE_VERSION.x | bash -
RUN apt-get install -y nodejs
RUN corepack enable && corepack prepare yarn@stable --activate

# Clean up apt stuff
RUN apt-get clean -q -y \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /source

ENV NODE_ENV=development

# Install dependencies (in separate docker layer from app code)
COPY .yarn .yarn
COPY patches patches
COPY package.json yarn.lock .yarnrc.yml ./
ENV VERBOSE_YARN_LOG=discard
RUN yarn install --immutable

# Copy in application code
COPY . .

# region Generate EdgeDB TS/JS files
RUN chown -R edgedb:edgedb dbschema

# Hook `yarn edgedb:gen` into edgedb bootstrap.
# This allows it to be ran in parllel to the db server running without a daemon
RUN mkdir -p /edgedb-bootstrap-late.d \
  && printf "#!/usr/bin/env bash\ncd /source \nyarn edgedb:gen" \
  > /edgedb-bootstrap-late.d/01-generate-js.sh
RUN chmod +x /edgedb-bootstrap-late.d/01-generate-js.sh

# Ignore creds during this build process
ENV EDGEDB_SERVER_SECURITY=insecure_dev_mode
# Don't start/host the db server, just bootstrap & quit.
ENV EDGEDB_SERVER_BOOTSTRAP_ONLY=1

# Bootstrap the db to apply migrations and then generate the TS/JS from that.
RUN /usr/local/bin/docker-entrypoint.sh edgedb-server
# endregion

# Build server
RUN yarn build

# Remove non-production code
RUN rm -rf nest-cli.json tsconfig* test
# Remove dev dependencies
RUN yarn workspaces focus --all --production
RUN yarn cache clean --all

# Production stage which is clean from our base node stage
# Since this is separate from dev/builder it won't include
# the docker layers to get to the production files.
# This reduces the image size by ~60%!
FROM node as production

# Copy everything from builder stage to this run stage
COPY --from=builder /source /opt/cord-api
WORKDIR /opt/cord-api

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
