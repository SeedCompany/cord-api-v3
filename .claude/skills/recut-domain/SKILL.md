---
name: recut-domain
description: >-
  Recut/port a single domain from the pg-e2e-harness (mono) branch onto develop
  as a clean, reviewable Drizzle PR during the Neo4j→Postgres migration. Use
  whenever starting or continuing a domain port — e.g. "recut Language", "port
  Engagement to PG", "start the Partnership PR", "cut the next spine link".
  Covers scoping from mono, the schema/repo/handler PR split, the validation
  gauntlet, decision-surfacing, the PR handoff, and the accumulated gotchas.
---

# Recut a domain (Neo4j → Postgres, mono → develop)

## Ground truth
- **mono (`pg-e2e-harness`) is the source of truth** — every domain is already
  built and e2e-validated there. A recut = strip/stub/renumber mono's code onto
  develop, NOT a from-scratch build.
- **develop** is the target (migrations `0000..N`). Branch off the previous
  spine link (or develop). Harness + File + admin bootstrap are on develop, so
  PG e2e boots.
- Consult migration memory first: `migration_postgres.md`,
  `project_domain_recut_scope.md`, `migration_timeline.md`, and the `feedback_*`
  entries for domain-specific scope + accumulated findings. Update it after.

## PR split
- Simple domain → **1 PR**.
- Circular/large (Project-class) → **schema PR → repos+auth PR → handlers PR**.
- Cannot split a pair joined by circular `*FilterClauses` imports (e.g.
  Project+ProjectMember) — build them together.

## 0. Scope from mono
`git diff develop pg-e2e-harness -- <domain paths>` — take **mono's** version.
Catalog: schema block · migration + `_journal` entry · Drizzle repo(s) +
`<domain>.module.ts` splitDb line · service/repo deltas · handlers · auth
conditions · tests · CI pattern.
- **STRIP** (absent on develop): audit `ResourceMutatedHook` firing, pin wiring
  → replace with stubs + `migration-todo:`.
- **PULL IN** (introduced by this domain, absent on develop): custom pg types,
  new error matchers, exported `*FilterClauses` / `*SortColumns`.

## 1. Schema + migration
- Extract mono's schema block verbatim; add type + `pg-core` imports; **REUSE**
  existing enums (don't redeclare `sensitivity`, `project_type`, etc.).
- Copy mono's migration SQL; renumber to develop's next free `NNNN`.
- Append `_journal.json` (idx, tag); **sequence your entry LAST on conflict** —
  it's the one recurring per-PR merge conflict.
- **Index every FK column** with a full b-tree index. A partial-unique leading
  column does NOT count — it excludes soft-deleted rows, so PG can't use it for
  FK maintenance / `ON DELETE CASCADE`. (Drift class: `who_idx`,
  `project_members_project_id_idx`.) Verify **schema ↔ SQL index parity**.
- **Surface schema decisions to Rob BEFORE locking** — pgEnum vs `text[]`;
  deferred-text FK vs real FK; any enum value set. Never default silently.

## 2. Repos + auth + service
- Port the Drizzle repo; strip pin/audit; keep engine-agnostic helpers
  (`getActualChanges`, `isUnique`) — they live on the base class.
- `splitDb(<Neo4jRepo>, { postgres: <DrizzleRepo> as any })` + `migration-todo:`
  on the cast (transition-only; deleted at cutover).
- Guard unknown sort keys: `if (!(sort in sortColumns)) throw NotImplementedException`
  — `resolveOrderBy`'s `?? fallback` silently mis-sorts otherwise.
- Port `asDrizzleCondition` only for conditions the repo actually uses via
  `filterToReadable`.
- Tag every `if (config.databaseEngine === ...)` branch and every stub with a
  `migration-todo:` naming what to drop at cutover.

## 3. Validate — run for EVERY PR
```bash
yarn type-check          # exit 0
yarn lint                # exit 0, zero warnings
```
Fresh-DB migration apply (proves the hand-written SQL; `--> statement-breakpoint`
markers are valid SQL comments so psql applies files directly):
```bash
PG=cord-api-v3-postgres-1
docker exec -e PGPASSWORD=postgres -i $PG psql -U postgres -q \
  -c "DROP DATABASE IF EXISTS recut_check;" -c "CREATE DATABASE recut_check;"
cat $(ls src/core/drizzle/migrations/*.sql | sort) | \
  docker exec -e PGPASSWORD=postgres -i $PG psql -U postgres -d recut_check -v ON_ERROR_STOP=1 -q
# Smoke-test the un-e2e-able DDL: GENERATED columns, triggers (+ order-independence), typed FKs.
docker exec -e PGPASSWORD=postgres -i $PG psql -U postgres -q -c "DROP DATABASE recut_check;"
```
Dual-engine e2e (Neo4j run is the oracle; PG must match — parity IS the test):
```bash
docker compose up -d postgres          # + a redis on 6379 (compose has none)
DATABASE=postgres POSTGRES_URL=postgresql://postgres:postgres@localhost:5432/cord \
  POSTGRES_POOL_SIZE=3 yarn test:e2e --runInBand <domain> user tool
```
`--runInBand` — parallel froze the machine. Add `<domain>` to the postgres
`--testPathPatterns` alternation in `.github/workflows/test.yml`.

## 4. Handoff + memory
- **PR handoff**: H3 + bullets (no tables), wrapped in a 4-backtick fence for
  paste, with a schema-DDL section. Sections: context + recut method · files ·
  what's added · intentional deltas vs mono · validation performed · reviewer
  cross-checks · explicitly out-of-scope (so a reviewer doesn't flag deferred
  work as missing).
- **Update migration memory**: resolved decisions + any generalizable finding
  (new drift class, new gotcha).

## Critical gotchas (full set in `migration_postgres.md`)
- pg-error matchers must unwrap `.cause` via `asDatabaseError` — drizzle wraps
  execution errors in `DrizzleQueryError` (bare `instanceof DatabaseError` is
  always false).
- Raw `db.execute` returns timestamps as SQL strings → `DateTime.fromSQL`, not
  `fromISO`; `.toMillis()` before any numeric compare.
- Partial unique index (`... WHERE deleted_at IS NULL`) for soft-delete uniqueness.
- Domains with time-travel tests: set `createdAt: DateTime.now().toJSDate()`
  explicitly — `defaultNow()` uses the DB clock and ignores luxon `Settings.now`.
- `relations()` is required (even empty) or `db.query.<t>.findMany()` returns
  `undefined`.
- Drizzle naming: `predicate` (not `where`) for composed conditions;
  `updateColumns` (not `updateProperties`) for the base partial-update helper.
- Migration numbers are branch-local bookkeeping; finalize at land, all
  discarded at the cutover drizzle-kit genesis squash.
