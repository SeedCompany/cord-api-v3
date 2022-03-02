# Base node stage that sets up common config for dev & prod
FROM ghcr.io/tarampampam/node:16-alpine as node

LABEL org.opencontainers.image.title="CORD API"
LABEL org.opencontainers.image.vendor="Seed Company"
LABEL org.opencontainers.image.source=https://github.com/SeedCompany/cord-api-v3
LABEL org.opencontainers.image.licenses="MIT"

WORKDIR /opt/cord-api

RUN apk add --no-cache jq

ENV NODE_ENV=development PORT=80

EXPOSE 80

CMD ["yarn", "start:prod"]

HEALTHCHECK CMD wget --no-verbose --tries=1 --spider http://localhost || exit 1

ARG GIT_HASH
ARG GIT_BRANCH
RUN echo GIT_HASH=$GIT_HASH > .env
RUN echo GIT_BRANCH=$GIT_BRANCH >> .env

# Dev stage that installs dependencies and copies project files
# This stage can run everything
FROM node as dev

# Install dependencies (in separate docker layer from app code)
COPY .yarn .yarn
COPY patches patches
COPY package.json yarn.lock .yarnrc.yml ./
RUN yarn install --immutable

# Copy application code
COPY . .

# Build server
RUN yarn build


# Temporary builder stage that cleans files from dev stage for production
FROM dev as builder

# Remove non-production code
RUN rm -rf nest-cli.json tsconfig* test
# list and remove dev dependencies
# yarn v2 doesn't have an install only production deps command
RUN jq -r '.devDependencies | keys | .[]' package.json | xargs yarn remove


# Production stage which is clean from our base node stage
# Since this is separate from dev/builder it won't include
# the docker layers to get to the production files.
# This reduces the image size by ~60%!
FROM node as production

# Copy everything from builder stage to this run stage
COPY --from=builder /opt/cord-api .

ENV NODE_ENV=production
