# Refreshing the scrubbed dev data

How a production Postgres dump becomes `cord-scrubbed-<date>.dump`, the file
every developer restores with the recipe in the top-level README.

## The one irreversible mistake

**The scrub rewrites the database it is pointed at, in place.** A copy and the
original are identical in content; only the connection string tells them
apart. Two things protect against pointing it at the wrong one:

- It refuses any database whose name does not start with `cord_scrub_`.
- It reads `POSTGRES_URL` only from the command line, never from `.env.local`,
  so the target is visible in the command that ran.

Everything else here is recoverable. Keep production credentials out of the
shell you do this in anyway.

## 1. Get a raw dump

Outside this tool. Either a `pg_dump` through existing database access, or an
RDS snapshot restored to a temporary instance and dumped from there. Custom
format (`-Fc`) is what the restore below expects:

```bash
pg_dump --format=custom --no-owner --no-privileges "$PROD_URL" > prod-raw-$(date +%Y%m%d).dump
```

Real production data is now on the laptop. It stays only between this step
and a verified scrub, and the app must not be started against it in between
(boot would run migrations and the root-user sync on it).

## 2. Restore it into a throwaway database

```bash
docker compose exec -T postgres psql -U postgres -c "create database cord_scrub_$(date +%Y%m%d)"
docker compose exec -T postgres pg_restore -U postgres -d cord_scrub_$(date +%Y%m%d) \
  --no-owner --no-privileges < prod-raw-$(date +%Y%m%d).dump
```

## 3. Dry run

```bash
POSTGRES_URL="postgresql://postgres:postgres@localhost:5432/cord_scrub_$(date +%Y%m%d)?sslmode=no-verify" \
  yarn scrub --dry-run
```

Reads and counts everything, rolls back, then runs the verifier — which on a
raw copy reports what is currently exposed. That is the negative control: it
proves the probes fire. Expect the run to refuse if:

- **the dump has a column the code does not know.** Production is newer than
  the branch. Pull the schema and classify the column (see below), or scrub
  from a branch that has it.
- **a name pool is too small.** Widen it in `theme.ts`.

A column the code knows but the dump lacks is only a warning: it is skipped.

## 4. Scrub, verify, dump

```bash
SCRUB_DEV_PASSWORD=localdev \
POSTGRES_URL="postgresql://postgres:postgres@localhost:5432/cord_scrub_$(date +%Y%m%d)?sslmode=no-verify" \
  yarn scrub --source="prod snapshot $(date +%Y-%m-%d)" \
             --out=~/cord-dev-seed/cord-scrubbed-$(date +%Y%m%d).dump
```

One transaction: an interrupted run leaves the raw restore untouched rather
than a copy that looks half clean. Every account's password becomes
`SCRUB_DEV_PASSWORD` (the root account is re-synced to `devops@tsco.org` /
`admin` by the app on its next boot). The verifier runs afterwards and the
command exits non-zero on any violation. `--source` is free text recorded in
the marker.

`--out` runs `pg_dump` from `PATH` (or `$PG_DUMP`). On a laptop whose only
Postgres is the compose container there is none, and the command prints the
one-liner to run instead:

```bash
docker compose exec -T postgres pg_dump --format=custom --no-owner --no-privileges \
  -U postgres cord_scrub_$(date +%Y%m%d) > ~/cord-dev-seed/cord-scrubbed-$(date +%Y%m%d).dump
```

Then upload the dump to wherever the team fetches it from, and drop the
throwaway database and the raw dump:

```bash
docker compose exec -T postgres psql -U postgres -c "drop database cord_scrub_$(date +%Y%m%d)"
rm prod-raw-*.dump
```

### Checking a copy later

```bash
POSTGRES_URL=... yarn scrub --verify-only
```

Read-only, any database name. Prints the marker (`scrub_provenance` table:
when, which classification, how many values) and re-runs every probe.

## What gets replaced, and the rules

`classification.ts` is the allowlist: every table, and every text / jsonb /
text-array column that is not a key or an enum, with a decision. It is
**enforced**:

- `classification.spec.ts` walks the Drizzle schema and fails on any
  free-text column without an entry, so a new column cannot ship undecided.
- The scrub repeats that check at run time, and also compares the live
  database to the schema (a newer dump is refused).
- `review` entries block the run. An unanswered question is not `safe`.

Strategies, all deterministic (same input → same fake on every refresh, so
bookmarks and screenshots keep pointing at the same thing):

| strategy | what it does |
| --- | --- |
| `givenName` / `surname` | one name from the reviewed pools in `theme.ts`, keyed per row so two people with the same real name get different fakes |
| `projectName`, `organizationName`, `locationName`, `fieldZoneName`, `fieldRegionName`, `fundingAccountName`, `toolName`, `filmName`, `storyName`, `ethnoArtName` | themed names assigned through a registry, so a column under a unique index stays unique and "Mudi", "Mudi 2", "Mudi 3" stay a family |
| `fileName` / `directoryName` | themed by hash, extension kept |
| `languageName` | themed by hash, so `name` and `display_name` stay equal |
| `email` | `<handle>.<tag>@example.invalid` — reserved, never routable |
| `phone` | the 555-01xx fictional block |
| `prose` / `uniqueProse` | generated sentences of comparable length; the unique variant adds a digest tag |
| `richText` | same blocks, same ids, new words |
| `entityName` / `acronym` / `address` | generated, tagged where uniqueness needs it |
| `credential` | the dev password hash |
| table `truncate` | sessions, reset tokens, webhooks, the audit trail |

Two rules worth knowing before editing:

- **Editing a pool reshuffles who gets which name**, so batch pool edits and
  expect copies scrubbed before and after not to match.
- **Never re-scrub a scrubbed copy to apply a change.** Every generator reads
  the value it replaces, so a second pass reads fakes and distinctness only
  shrinks. Restore fresh, then scrub.

## Classifying a new column

Add it under its table in `classification.ts`:

```ts
myTable: {
  columns: {
    nickname: scrub('prose'),          // free text
    externalRef: safe('opaque id'),    // say why it is safe
    parentId: structural,              // references a row
  },
},
```

A column whose strategy depends on another column uses `perType` (see
`file_nodes.name`). Run `yarn test --testPathPatterns=src/core/scrub` — the
spec says what is still missing.
