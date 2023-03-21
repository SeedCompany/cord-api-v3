# Base node stage that sets up common config for dev & prod
FROM public.ecr.aws/docker/library/node:18-slim as node

LABEL org.opencontainers.image.title="CORD API"
LABEL org.opencontainers.image.vendor="Seed Company"
LABEL org.opencontainers.image.source=https://github.com/SeedCompany/cord-api-v3
LABEL org.opencontainers.image.licenses="MIT"

WORKDIR /opt/cord-api

ENV NODE_ENV=development PORT=80

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
COPY patches patches
COPY package.json yarn.lock .yarnrc.yml ./
ENV VERBOSE_YARN_LOG=discard
RUN yarn install --immutable

# Copy application code
COPY . .

# Build server
RUN yarn build


# Temporary builder stage that cleans files from dev stage for production
FROM dev as builder

# Remove non-production code
RUN rm -rf nest-cli.json tsconfig* test
# Remove dev dependencies
RUN yarn workspaces focus --all --production


# Production stage which is clean from our base node stage
# Since this is separate from dev/builder it won't include
# the docker layers to get to the production files.
# This reduces the image size by ~60%!
FROM node as production

# Copy everything from builder stage to this run stage
COPY --from=builder /opt/cord-api .

ENV NODE_ENV=production
