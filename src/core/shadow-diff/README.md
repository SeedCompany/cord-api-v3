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

## Latest run — 2026-07-30, EXTENDED corpus (83 → 135 ops/persona, 810 pairs)

**612 of 810 identical · 146 pairs with unsuppressed diffs · 52 suppressed-only.**
The corpus now covers the five waves it previously ignored: languages (+ethnologue),
engagements (both subtypes via the interface), products (all three fragments),
periodic reports, progress reports (status, all three summaries, prompt responses,
product progress), comment threads + comments, and posts. Pins are covered via
`Language.pinned`.

**The headline is that every new BY-ID document is clean.** Zero diffs on
`language.byId`, `product.byId`, `periodicReport.byId`, `progressReport.byId`,
`commentThread.byId` and `post.byId` across all six personas — so the report
cluster and the leaves read identically field-for-field, including the summaries,
prompt-response entries and step progress. That is the strongest parity evidence
this harness has produced for the newly-migrated domains.

The new-domain diffs are 14 ops / 674 entries and almost entirely **list** totals
and item windows, i.e. the ETL's known row drops showing through (languages 69→50,
engagements 117→80, products 363→275, periodic reports 2383→1869). Two exceptions
matter:

**🔴 NEW AND SERIOUS — a 2-row ethnologue drop breaks the whole language list.**
Postgres throws where Neo4j answers:

```
Language iaJWie869fn has no attached EthnologueLanguage — create-flow invariant violated
```

This kills `languages.list.default`, `languages.list.sort-createdAt-asc`,
`languages.list.filter-presetInventory` **entirely** (not one row — the whole query,
for Administrator), plus `engagement.byId` for any engagement whose language is
affected. Cause: the ETL drops 2 `ethnologue_languages` rows to the
code/provisional_code unique indexes, leaving `iaJWie869fn` and `Dw5mcfubJUG` with
no ethnologue row, and the Postgres language repo treats that as a hard invariant
while Neo4j tolerates it. This is the **ETH1** concern with a concrete
reproduction, and it escalates the unique-dup class: a dropped row is not only lost
data, it can make an entire list query fail. Prod exposure is unmeasured — the
`ethnologue.code` / `provisionalCode` legs of the cutover pre-flight are what size
it.

**`engagements.list.filter-status-active` (27 entries)** — differs by more than the
row drops; worth separating from the drop noise on a dataset without them.

The 23 pre-existing ops with diffs are unchanged from the run below, and none is a
newly-broken repository.

## Previous run — 2026-07-30, original 83-op corpus

**350 of 498 identical · 96 op×persona pairs with unsuppressed diffs · 52
suppressed-only.** Loaded into a dedicated `cord_shadow` database (NOT the dev
`cord` DB, which the ETL's TRUNCATE would otherwise wipe) from the same local
Neo4j, 46 tables reconciling. Both captures exited 0 — no recurrence of the S5
root-user hang.

⚠ **Read this number with the corpus in mind.** `corpus.ts` is hand-enumerated and
has not grown since 2026-07-14, while five domain waves have landed since. So this
run is a **regression check over the old surface**, not coverage of the new one:
periodic reports, progress reports, prompt responses, product progress, progress
summaries, comments, posts and pins are all migrated and **not queried by a single
operation here**. Treating 350/498 as a parity certificate would be a mistake —
the gate cannot certify what it does not ask about.

All 96 fall into five classes, none of them a newly-broken repository:

1. **Order-only** (`tools`, `fieldRegions`, `fieldZones`, `projects`, and the
   page-window shifts that follow in `organizations`/`users`) — identical SET and
   identical `total`, different sequence. This is the inspection the `collation`
   rule was waiting on, and for these ops it passes. Still left disabled, because
   suppressing it would also mask the second sub-case: PG repos lacking an `id`
   tie-break on equal sort keys is a real determinism defect, not a collation
   difference, and the two are indistinguishable from the diff alone. **Open
   question:** separate them before enabling.
2. **`locations` — real ETL data loss.** total 26 → 17. This is the
   `locations_iso_alpha3_active_unique` drop (cutover README finding #3, whose
   attribution was corrected the same day — it was blamed on `name` for weeks).
   It cascades: every `locations.list` page and total, plus
   `location.byId.defaultMarketingRegion` going null because the referenced
   location is one of the nine dropped.
3. **`project.byId` ×5 — PG errors where Neo4j returns data:** *"Could not find
   root directory associated to this project"*. Expected until File+Media loads
   `root_directory_id`; it should clear entirely with that wave, and is worth
   re-checking as a signal that the wave worked.
4. **NEW — `users.list.filter-status-active` totals 32 (Neo4j) vs 48 (Postgres).**
   Not a filter bug (`eq(users.status, filter.status)` is correct) — a data
   consequence of the ETL's `orDefault(status, 'Active')`. Locally 32 users have an
   Active status Property, **16 have none at all**, and 1 is Disabled; the ETL
   coalesces those 16 to Active, so "Active users" becomes a 50% larger set. The S6
   known-delta covers the status *value* but not a filtered list's *cardinality* —
   see the `S6-cardinality` rule, deliberately disabled so this stays red pending
   a call.
5. **NEW (minor, Neo4j-side, self-resolving) — sorting by a Property a node lacks
   drops that node from the result.** `sort-displayLastName` yields a Neo4j total of
   48 against 49 elsewhere, because the AnonUser node carries only
   gender/photo/status Properties and the sorter's match is required. Postgres
   keeps the row (`ORDER BY` on a null column). **Postgres is the correct one** — a
   sort must not change cardinality — so this needs no fix and dies at cutover.

## File map

- `../shadow-diff.run.ts` — entry (flags, boot, capture/diff dispatch).
- `types.ts` — shared types. `personas.ts` — persona resolution.
- `corpus.ts` — the hand-enumerated operations (the only file that grows).
- `capture.ts` — id sampling, in-process execution, capture writing.
- `known-deltas.ts` — suppression registry. `diff.ts` — comparison.
- `report.ts` — markdown/stdout rendering.
