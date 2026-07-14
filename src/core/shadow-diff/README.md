# Shadow-diff harness — Neo4j ↔ Postgres read parity

**Cutover-only tooling — this dies with the migration.** It exists to validate
that the Postgres repositories answer GraphQL reads identically to the proven
Neo4j ones, over the same dataset, before the `DATABASE=postgres` flip. Once
the cutover lands and Neo4j is torn down, delete this folder and
`../shadow-diff.run.ts`. Don't over-invest here.

## What it does

1. **Capture** — boots the app under the current `DATABASE` engine, replays a
   hand-enumerated **read-only** GraphQL corpus **in-process** (no HTTP) under
   several role personas, and writes `capture-<engine>.json`.
2. **Diff** — loads `capture-neo4j.json` (the oracle) + `capture-postgres.json`,
   compares with a known-deltas suppression registry, and writes `report.md` +
   `report.json`. Exits **1** if any UNSUPPRESSED difference exists.

Both engines must be loaded with the **same dataset** by the cutover ETL
(`src/core/cutover/`) — then responses should be identical except for real
parity bugs and registered known deltas.

## Runbook

Prereqs: dev Neo4j + Postgres up (`docker compose up -d postgres db`), the
Postgres DB loaded from that same Neo4j by the cutover ETL:

```bash
POSTGRES_URL=postgresql://postgres:postgres@localhost:5432/cord \
  yarn start --entryFile core/cutover.run
```

Then the three commands (output dir defaults to `shadow-diff-output/` at the
repo root — keep it out of git via `.git/info/exclude`, e.g.
`echo shadow-diff-output/ >> .git/info/exclude`; do not add it to `.gitignore`):

```bash
# 1. capture with Neo4j serving reads (the oracle)
DATABASE=neo4j POSTGRES_URL=postgresql://postgres:postgres@localhost:5432/cord \
  yarn start --entryFile core/shadow-diff.run -- --capture

# 2. capture with Postgres serving reads
DATABASE=postgres POSTGRES_URL=postgresql://postgres:postgres@localhost:5432/cord \
  yarn start --entryFile core/shadow-diff.run -- --capture

# 3. diff the two captures → report.md + report.json + stdout summary
yarn start --entryFile core/shadow-diff.run -- --diff
```

Flags: `--capture` | `--diff` · `--out=<dir>` (capture) · `--dir=<dir>` (diff).

Capture never mutates anything: the corpus is queries only, executed through
the ordinary resolver → service → repository path. (Note: under
`DATABASE=postgres` the app's boot path runs the Drizzle migrator; on a DB the
ETL already loaded, all migrations are applied and it's a no-op.)

**Gotcha — root user on a freshly ETL'd DB (fixed, ledger S5):** the ETL
originally loaded `users.is_root` as `false` for every row, and the postgres
admin bootstrap's `createRootUser` then PK-conflicted on the same configured
id — the bootstrap died in the background and `waitForRootUserId` polled
forever, so the capture (or ANY `DATABASE=postgres` boot) hung after schema
generation. The user extractor now sets `is_root` by matching the configured
root email, so fresh ETL loads boot fine. Only a DB loaded by a pre-fix ETL
run needs the one-row manual unblock:

```bash
docker exec cord-api-v3-postgres-1 psql -U postgres -d cord \
  -c "UPDATE users SET is_root=true WHERE email='devops@tsco.org';"
```

## Design

- **Two sequential process runs + file captures** — no live dual server.
- **In-process execution** via `graphql({ schema, ... })` with the schema from
  `GraphQLSchemaHost`. The capture boots a full Nest app (custom
  `HttpAdapter`) but never listens — the GraphQL module only builds the schema
  when an HTTP adapter exists (same recipe as `main.ts --gen-schema`).
- **Identity**: personas are arbitrary migrated users (no passwords), entered
  via `identity.asUser(userId, fn)`. The GraphQL context deliberately has
  **no `request`** — with one, the `SessionInterceptor` would resolve a session
  from it and clobber the persona; without one it early-returns. Each
  operation also runs inside `GqlContextHostImpl.als.run(context, ...)` since
  in-process execution bypasses the Yoga plugin that normally populates it.
  The process runs in CLI mode (`'console'` pushed into argv) so
  `ResourceLoader` uses `CLI_CONTEXT_ID` and the scheduler stays off.
- **Deterministic personas** (`personas.ts`): for each role in
  Administrator, ProjectManager, Consultant, Intern, FieldPartner, Marketing,
  StaffMember — the live user with the lowest id holding that global role,
  resolved **from Postgres in both runs** (`POSTGRES_URL` is always set).
  Roles with no user are skipped + logged. The diff asserts both captures
  resolved identical personas.
- **Deterministic id sampling**: by-id documents run against the first K=5
  live ids (ordered by id) from the domain's PG table — same ids both runs,
  asserted in the diff.
- **Errors are data**: `{ data, errors }` is captured per operation (errors
  normalized to message + code + path — no stacks). Deny-vs-allow or
  error-shape differences between engines are exactly the signal we want.
- **Normalization is minimal**: values that are both ISO instants for the
  same moment but in different string forms are treated equal (and counted in
  the report). Null-vs-missing-vs-empty-array is NEVER normalized — those are
  real finding classes. List order is compared as-is — ordering drift IS
  signal.

## Corpus coverage (corpus.ts)

12 queryable landed+ETL'd domains: users, tools, fundingAccounts, locations,
fieldZones, fieldRegions, organizations, partners, projects, projectMembers,
partnerships, notifications.

- **projectMembers** have no top-level query — they are covered via the
  `project.team` sub-selection on the project by-id document.
- **Education/Unavailability** are covered as sub-selections on the user
  by-id document.
- **EthnologueLanguage is excluded** — it is only reachable through Language,
  which hasn't landed on Postgres.
- **notifications** are requester-scoped: per-persona results are expected and
  must match across engines for the same persona.

Per list: default sort, 1–2 real non-default sorts (name-ish + `createdAt`),
ASC/DESC on the name sort, one obvious filter where the input has one — each
selecting `total` + `hasMore` + item ids. Per by-id: full secured-field
coverage of **migrated-backed fields only**. Every excluded field is commented
in `corpus.ts` with the reason (PG stub, unmigrated boundary) so re-adding at
each domain land is a grep for the domain name.

### Adding a domain when its recut lands

1. In `corpus.ts`: add a by-id document (full secured-field selection — crib
   from `test/utility/fragments.ts`, do NOT import test files) + list variants
   (default sort, name + createdAt sorts, an obvious filter). Check the
   domain's `list-*.dto.ts` for real sort keys.
2. If it should be id-sampled: add the domain to `SampledDomain` in `types.ts`
   and its table to `sampledTables` in `capture.ts`.
3. Grep `corpus.ts` for the domain name and re-add any field selections that
   were excluded as "not landed".
4. Re-run ETL + both captures + diff.

### Adding a known-delta rule

In `known-deltas.ts`, append a rule with `op`/`persona`/`path` regexes and a
mandatory `reason` + `ref` (miss-ledger id). Suppressed diffs are counted and
listed in the report — never silent. Only add a rule for a difference that has
been investigated and accepted; everything else should stay red.

Seeded rules: `S1` (inactive-membership visibility on project reads under
member personas), `U14` (user.photo null shape), and a **disabled** collation
placeholder for order-only diffs on name sorts (enable only after inspecting).

## Reading the report

- `report.md` — summary table (operation × persona: `✓` / `D<n>` unsuppressed
  / `S<n>` suppressed / `E` errors-mismatch), then per-diff detail (op,
  persona, JSON path, neo4j vs postgres values, truncated), then the
  suppressed section grouped by rule ref.
- `report.json` — the full machine-readable report.
- Exit code 1 ⇔ any unsuppressed diff.

Expected local-dev noise: the dev dataset has known ETL gaps (e.g. duplicate
live location names dropped by `onConflictDoNothing` — see
`src/core/cutover/README.md` findings). Those correctly show up as real diffs
(`total` mismatches etc.) until the ETL findings are resolved — that's the
harness doing its job, not a harness bug.

## File map

- `../shadow-diff.run.ts` — entry (flags, boot, capture/diff dispatch).
- `types.ts` — shared types. `personas.ts` — persona resolution.
- `corpus.ts` — the hand-enumerated operations (the only file that grows).
- `capture.ts` — id sampling, in-process execution, capture writing.
- `known-deltas.ts` — suppression registry. `diff.ts` — comparison.
- `report.ts` — markdown/stdout rendering.
