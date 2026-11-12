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
1. Load data (recommended): restore the scrubbed production dump into the
   database before the app's first boot (stop the API first if it's running):
    ```bash
    yarn db:restore
    ```
   This downloads the dump from S3 and needs AWS credentials that can read it;
   see [Seeding the database](#seeding-the-database) for the options, what the
   script does and its safety checks.

   Sign in as `devops@tsco.org` / `admin` — the default root account, which the
   app re-syncs on every boot. Skipping this step is fine too — the app boots
   against the empty database and applies migrations itself.

## Database

PostgreSQL is the database (production cut over from Neo4j in September 2026),
accessed through Drizzle. The schema lives in `src/core/drizzle/schema`.

Migrations run automatically on startup. They are hand-written SQL files in
`src/core/drizzle/migrations`, each with a matching entry in
`migrations/meta/_journal.json`. A file without a journal entry is never
applied, and drizzle skips any entry whose `when` is not later than the newest
one a database has already applied. Don't use `yarn migrate:generate`: there
are no drizzle-kit snapshots, so it emits the entire schema as one migration.

### Seeding the database

The scrubbed production dump (a `pg_dump -Fc` archive with nothing identifiable
in it) is the shared starting point for local, Dev and QA databases. It lives in
the private S3 bucket `cord-v3-seed-data`, at `cord/scrubbed.dump`.

#### Local

```bash
yarn db:restore                      # download the default dump from S3 and restore it
yarn db:restore --file <path>        # restore a dump you already have
yarn db:restore --s3 <uri-or-key>    # restore a different S3 object (s3://bucket/key, or a key in the seed bucket)
yarn db:restore --yes                # skip the confirmation prompt
```

You need Docker and the compose `postgres` service. The S3 options also need the
AWS cli with credentials that can read `cord/scrubbed*` in the bucket; `--file`
needs no AWS access. Stop the API first, since open connections are terminated.

What the script does, and the checks it makes:

- Restores into a scratch database first and only replaces `cord` once that has
  fully succeeded, so a truncated or corrupt dump leaves your existing database
  untouched.
- Makes you type the database name before wiping anything (unless `--yes`).
- Runs everything through `docker compose exec` into the compose container and
  refuses a non-local Docker daemon (a remote `DOCKER_HOST` or Docker context),
  so it can't be pointed at a real environment.
- Stamps the database as seeded from the scrubbed dump
  (`cord-seed-lineage=scrubbed`) and refuses to overwrite one marked with a
  different lineage. A database with data and no marker (your own hand-built
  data) gets a warning and the confirmation prompt.

Afterwards, start the API: it applies any migrations newer than the dump, which
only has the initial one, and re-syncs the root account. Sign in as
`devops@tsco.org` / `admin`. Other users' passwords depend on how the dump was
generated and on `PASSWORD_SECRET`, so don't count on them.

#### Dev and QA

The deployed Dev and QA databases are refreshed from the same dump, but not from
this repo. A guarded one-off task defined in the
[infra repo](https://github.com/SeedCompany/infra) does it. Its
[`cord-db-refresh.md`](https://github.com/SeedCompany/infra/blob/master/cord-db-refresh.md)
covers how it works, the checks that keep Prod and Training from ever being
refreshed, how to run it, and how to publish a new dump to the bucket.

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

## Deploying a PR to the Dev environment

The shared Dev environment (API at https://api.dev.cordfield.com, UI at
https://dev.cordfield.com) can run the code from a specific PR instead of
`develop`, so you can test a branch — including long-lived ones — on real infra.

**To use it:** add the `dev-deploy` label to your PR.

- The PR's code deploys to Dev within a few minutes; deploy status shows on the
  PR's checks.
- Push more commits to that PR and Dev redeploys automatically.
- Only one PR holds Dev at a time. If another PR already has it, adding the label
  is declined — the label is removed and a comment tells you which PR to free up
  first.
- Remove the label, or merge/close the PR, to release your hold. Dev keeps
  running that last deploy until someone else grabs it (it does not revert to
  `develop` on its own).

**How it works:** a machine-owned pointer branch,
`deployment/dev-environment-pipeline`, always points at whatever is currently
deployed to Dev. The [`dev-deploy` workflow](.github/workflows/dev-deploy.yml)
moves that pointer to your PR's head commit when the label is added (or when a
labeled PR gets new commits). The AWS pipeline — configured in the infra repo at
`src/stacks/cord-v3.ts` (the `Cord-Dev` stack) — watches that branch and builds
and deploys whatever it points at.

A couple of notes:

- Don't push to `deployment/dev-environment-pipeline` by hand. It's managed by
  the workflow, and because it has no branch protection a manual push would also
  deploy.
- PRs from forks aren't supported (their commits aren't in this repo); the
  workflow removes the label and comments if you try.

## Documentation

[NestJS](https://docs.nestjs.com/)
[GraphQL](https://graphql.org/learn/)

## License

CORD is [MIT licensed](LICENSE).
