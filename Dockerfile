# Base node stage that sets up common config for dev & prod
FROM node:12-alpine as node
WORKDIR /opt/cord-api

# Add wait-for utility to make waiting for db easier (see usage in docker-compose.yml)
# From https://github.com/eficode/wait-for/pull/9 (has fixes for env handling)
ADD https://raw.githubusercontent.com/eficode/wait-for/96511d65c6578d4866591283fdec6e2fba7e6770/wait-for /usr/local/bin/wait-for
RUN chmod +x /usr/local/bin/wait-for

RUN apk add --no-cache jq

ENV NODE_ENV=development \
    NEO4J_URL= \
    NEO4J_USERNAME= \
    NEO4J_PASSWORD= \
    JWT_AUTH_KEY= \
    FILES_S3_BUCKET= \
    PORT=80

EXPOSE 80

CMD ["yarn", "start:prod"]

ARG GIT_HASH
ARG GIT_BRANCH
RUN echo GIT_HASH=$GIT_HASH > .env
RUN echo GIT_BRANCH=$GIT_BRANCH >> .env

# Dev stage that installs dependencies and copies project files
# This stage can run everything
FROM node as dev

# Install dependencies (in separate docker layer from app code)
COPY .yarn .yarn
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
