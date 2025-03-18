# CORD API v3

## Description

Bible translation project management API.

## Requirements

1. Docker from their website (complications with homebrew)
1. NodeJS (`brew install node corepack && corepack enable`)
1. Gel (`brew install geldata/tap/gel-cli`)

## Setup

1. Ensure you meet the NodeJS version requirement found in [package.json](./package.json).
1. Ensure corepack is enabled `corepack enable`
1. Run `yarn` to install dependencies
1. Use docker to run the current database (neo4j) locally: `docker-compose up -d db`.  
1. Setup an Gel instance (the next gen database replacing neo4j)
    ```bash
    gel project init
    yarn gel:gen
    ```

## Usage

Develop: `yarn start:dev`  
Test: `yarn test:e2e`

See scripts in [package.json](./package.json) for other commands to run

## Documentation

[NestJS](https://docs.nestjs.com/)
[Gel](https://docs.geldata.com/)
[GraphQL](https://graphql.org/learn/)

## License

CORD is [MIT licensed](LICENSE).
