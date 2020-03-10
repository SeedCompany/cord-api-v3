FROM node:12-alpine

ENV NODE_ENV=development \
    PORT=3000 \
    NEO4J_URL= \
    NEO4J_USERNAME= \
    NEO4J_PASSWORD= \
    JWT_AUTH_KEY= \
    FILES_S3_BUCKET=

# Setup server env dependencies
RUN apk --no-cache --update --virtual build-dependencies add build-base python

RUN mkdir -p /opt/cord-api

WORKDIR /opt/cord-api

# We copy the package.json and yarn.lock separately to ensure "yarn install" Docker cache is busted only when these files change
ADD package.json yarn.lock ./
RUN yarn

# Setup application code and symlink to node modules
COPY . .

RUN yarn build

RUN apk del build-dependencies

EXPOSE $PORT

CMD ["node", "dist/main.js"]
