FROM node:12-alpine
WORKDIR /usr/src/app

COPY . .

RUN apk --no-cache --update --virtual build-dependencies add build-base python

RUN yarn

RUN apk del build-dependencies

EXPOSE 3000

CMD ["yarn", "run", "start:dev"]
