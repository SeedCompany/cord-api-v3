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
1. Copy `.env.local.example` to `.env.local` and fill in any required values
1. Start the databases:
    ```bash
    docker-compose up -d db postgres
    ```
1. Setup a Gel instance (the current primary database):
    ```bash
    gel project init
    yarn gel:gen
    ```

## Database

The app is mid-migration from Neo4j to PostgreSQL. Both databases run simultaneously.
The `DATABASE` env var controls which is active for each domain:

| Value | Behavior |
|-------|----------|
| `neo4j` (default) | All domains use Neo4j |
| `postgres` | Domains with a PostgreSQL repository use it; rest fall back to Neo4j |

Both services must be running locally regardless of which mode is active:

```bash
docker-compose up -d db        # Neo4j
docker-compose up -d postgres  # PostgreSQL
```

PostgreSQL migrations run automatically on startup when `DATABASE=postgres`.
To generate a new migration after a schema change:

```bash
yarn migrate:generate
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
