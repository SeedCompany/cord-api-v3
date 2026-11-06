# CORD API v3

## Description

Bible translation project management API.

## Requirements

1. Docker from their website (complications with homebrew)
1. NodeJS (`brew install node corepack && corepack enable`)

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
1. Load data (recommended): restore the current scrubbed production dump,
   which lives in the private `cord-v3-seed-data` S3 bucket. You need AWS
   credentials that can read it (same SSO profile you use for the other envs):
    ```bash
    yarn db:restore                      # download from S3 and restore
    yarn db:restore --file <dump>        # or use a dump you already have
    yarn db:restore --s3 <uri-or-key>    # or a different object in S3
    ```
   This drops and recreates the `cord` database inside the compose container
   (so stop the API first), restores the dump, and stamps the database as
   seeded from the scrubbed dump. It only ever talks to the compose container —
   never to a host/port — so it can't be aimed at a tunnel to a real
   environment. Start the API afterwards; it applies any migrations newer than
   the dump.

   Sign in as `devops@tsco.org` / `admin` — the default root account, which the
   app re-syncs on every boot. Skipping this step is fine too — the app boots
   against the empty database and applies migrations itself. To load a dump
   later, stop the app and run `yarn db:restore` again; it replaces whatever is
   in the `cord` database.

## Database

PostgreSQL is the database (production cut over from Neo4j in September 2026),
accessed through Drizzle. The schema lives in `src/core/drizzle/schema`.

Migrations run automatically on startup. They are hand-written SQL files in
`src/core/drizzle/migrations`, each with a matching entry in
`migrations/meta/_journal.json`. A file without a journal entry is never
applied, and drizzle skips any entry whose `when` is not later than the newest
one a database has already applied. Don't use `yarn migrate:generate`: there
are no drizzle-kit snapshots, so it emits the entire schema as one migration.

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
