# CORD API v3

## Description

Bible translation project management API.

## Requirements

1. Docker from their website (complications with homebrew)
1. NodeJS (`brew install node corepack && corepack enable`)
1. Gel (`brew install geldata/tap/gel-cli`) — build-time only, see [Setup](#setup)

## Setup

1. Ensure you meet the NodeJS version requirement found in [package.json](./package.json).
1. Ensure corepack is enabled `corepack enable`
1. Run `yarn` to install dependencies
1. Copy `.env.example` to `.env.local` and fill in any required values
1. Start the database:
    ```bash
    docker compose up -d
    ```
   The first boot creates an empty `cord` database and generates a self-signed
   certificate. The API's PG client always performs an SSL handshake — even
   against a local server — which is also why `POSTGRES_URL` ends in
   `?sslmode=no-verify`.
1. Load data (recommended): ask a teammate for the current scrubbed production
   dump and restore it:
    ```bash
    yarn pg:restore ~/cord-dev-seed/cord-scrubbed-<date>.dump
    ```
   The script drops and recreates the `cord` database before restoring, so it
   also works for reloading a newer dump later — just stop the API first (it
   refuses to run while anything is connected). Sign in as `devops@tsco.org` /
   `admin` — the default root account, which the app re-syncs on every boot.
   Skipping this step is fine too — the app boots against the empty database
   and applies migrations itself.
1. Set up a Gel instance. Gel is **not used at runtime** — it is a leftover
   migration target whose code is still in the tree — but its generated client
   is not committed, so the project will not compile without this step:
    ```bash
    gel project init
    yarn gel:gen
    ```
   Re-run `yarn gel:gen` after any change to `dbschema/`. The Gel instance only
   needs to be running for that command, not for the app.

## Database

PostgreSQL is the database — production cut over from Neo4j in September 2026.
The legacy Neo4j and Gel code paths are still in the tree pending removal.
`DATABASE` picks the engine and defaults to `postgres`; there is no longer a
reason to set it to anything else.

Migrations run automatically on startup. To generate a new migration after a
schema change:

```bash
yarn migrate:generate
```

## Usage

Develop: `yarn start:dev`  
Test: `yarn test` (unit) and `yarn test:e2e` (end-to-end)

See scripts in [package.json](./package.json) for other commands to run

### End-to-end tests

`POSTGRES_URL` has to be a **real environment variable** for the e2e suite —
each spec file creates its own throwaway database before the app, and therefore
dotenv, has loaded:

```bash
export POSTGRES_URL='postgresql://postgres:postgres@localhost:5432/cord?sslmode=no-verify'
yarn test:e2e
```

To run a single spec file, use `yarn test:e2e --testPathPatterns=<pattern>`
(a bare positional pattern is silently swallowed by yarn and runs everything).

> [!WARNING]
> Point this at a **dedicated, disposable PostgreSQL server** — the local
> `docker compose` one is what it is meant for. Never a production or shared
> server.

The end-to-end setup needs rights to create and drop databases, and on each run
it also clears its own leftovers: any database named `cord_e2e_*` more than an
hour old is dropped `with (force)`, which disconnects whatever is attached to
it. The sweep is scoped to that prefix and cannot reach application data, but on
a server someone else is using it can still end their test run.

Requiring the URL to be passed explicitly, rather than reading it from
`.env.local` alongside everything else, is what keeps all of that from pointing
at a server inherited from a file you had forgotten about.

## Documentation

[NestJS](https://docs.nestjs.com/)
[GraphQL](https://graphql.org/learn/)

## License

CORD is [MIT licensed](LICENSE).
