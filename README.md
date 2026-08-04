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
    docker compose up -d db postgres
    ```
1. Setup a Gel instance. Gel is not the primary database — see [Database](#database)
   below — but a number of repositories still use it and its generated client is
   not committed to the repo, so the project will not compile without this step:
    ```bash
    gel project init
    yarn gel:gen
    ```
   Re-run `yarn gel:gen` after any change to `dbschema/`.

## Database

The app is mid-migration from Neo4j to PostgreSQL. Both databases run simultaneously.
The `DATABASE` env var controls which is active for each domain:

| Value | Behavior |
|-------|----------|
| `neo4j` (default) | All domains use Neo4j |
| `postgres` | Domains with a PostgreSQL repository use it; rest fall back to Neo4j |

Both services must be running locally regardless of which mode is active:

```bash
docker compose up -d db        # Neo4j
docker compose up -d postgres  # PostgreSQL
```

Gel is a third database in the tree, left from an earlier migration target. It is
neither the destination nor the primary store and nothing new is being built on
it, but it has not been removed yet — so setting it up is still required in order
to build. See [Setup](#setup) above.

PostgreSQL migrations run automatically on startup when `DATABASE=postgres`.
To generate a new migration after a schema change:

```bash
yarn migrate:generate
```

## Usage

Develop: `yarn start:dev`  
Test: `yarn test` (unit) and `yarn test:e2e` (end-to-end)

See scripts in [package.json](./package.json) for other commands to run

### Which database the tests run against

End-to-end specs choose their engine from `DATABASE`, resolved the way the app
resolves it: a real environment variable first, then the `.env` files, then the
`neo4j` default. So `DATABASE=postgres` in `.env.local` is enough to run the suite
against PostgreSQL, and `DATABASE=neo4j yarn test:e2e` overrides that for a single
run.

`POSTGRES_URL` is the exception — it has to be a **real environment variable**,
because each spec file creates its own throwaway database before the app, and
therefore dotenv, has loaded:

```bash
export POSTGRES_URL=postgresql://postgres:postgres@localhost:5432/cord
DATABASE=postgres yarn test:e2e
```

> [!WARNING]
> Point this at a **dedicated, disposable PostgreSQL server** — the local
> `docker compose` one is what it is meant for. Never a production or shared
> server.

The end-to-end setup needs rights to create and drop databases, and on each run
it also clears its own leftovers: any database named `cord_e2e_*` more than an
hour old is dropped `with (force)`, which disconnects whatever is attached to it.
The sweep is scoped to that prefix and cannot reach application data, but on a
server someone else is using it can still end their test run.

Requiring the URL to be passed explicitly, rather than reading it from `.env.local`
alongside everything else, is what keeps all of that from pointing at a server
inherited from a file you had forgotten about.

## Documentation

[NestJS](https://docs.nestjs.com/)
[Gel](https://docs.geldata.com/)
[GraphQL](https://graphql.org/learn/)

## License

CORD is [MIT licensed](LICENSE).
