# Cutover ETL — Neo4j → Postgres

One-time data migration run at cutover: reads every entity out of **Neo4j** (the
production DB) and inserts it into the corresponding **Postgres** (Drizzle)
tables, **ID-preserving**, with **no service/hook side-effects**. Separate from
the schema migrations (those build empty tables; this fills them).

> Status: **draft covering the firm (already-merged-to-develop) domains.** Built
> + validated end-to-end against a local Neo4j (`yarn` dev DB). NOT yet run
> against production data. See _Findings_ and _Not covered yet_.

## Strategy

Direct extract → transform → load, **not** replay through the services (which
would regenerate ids, fire hooks, and re-run today's validators on legacy data).
Each entity is read **through its existing Neo4j repository** so the proven
`hydrate()` assembles the full `UnsecuredDto` (fields live in `Property`-node
relationships — a raw `MATCH (n) RETURN n` won't hydrate them). The row is then
mapped to the Drizzle shape and bulk-inserted.

Boots with `DATABASE=neo4j` so `splitDb` resolves the **Neo4j** repositories
(the readers); `POSTGRES_URL` is the **write target** (`DrizzleService` connects
whenever the url is set, regardless of engine). The target schema is applied
here (migrations run) before loading, so it can point at an empty DB.

## Layout

- `cutover.types.ts` — `CutoverContext`, `Extractor` interface, stats.
- `cutover.helpers.ts` — `readAllViaRepo`, `bulkInsert`, `cypher`, value mappers
  (`ts`/`dateStr`/`linkId`/`orDefault`/`sanitizeEnum`).
- `cutover.harness.ts` — `runCutover`: topological order by `dependsOn`,
  TRUNCATE targets, run each extractor, reconcile row counts.
- `extractors/*.extractor.ts` — one per domain (`extractors/index.ts` registry).
- `../cutover.run.ts` — the entry point (boot + arg parsing + target migration).

## Running

**`DATABASE=neo4j` IS MANDATORY, not optional.** It is what makes `splitDb`
resolve the Neo4j repositories — the readers. Omit it and, if your env sets
`DATABASE=postgres`, `readMany` hydrates from the *target* Postgres instead of
the source: ids still enumerate from Neo4j (raw Cypher), so every domain reports
"N enumerated but NOT hydrated" and loads **zero rows**, and reconciliation says
`0 == 0 == 0 ✓`. A completely empty migration that reports success. The banner
line prints `engine=` — **check it says `neo4j` before trusting any run.**

```bash
# dry-run: read + map only. Writes NOTHING and its ✓ is tautological
# (see "What a dry-run does and does not prove" below).
DATABASE=neo4j POSTGRES_URL=postgresql://postgres:postgres@localhost:5432/cord_cutover \
  yarn start --entryFile core/cutover.run -- --dry-run

# real load of one domain
DATABASE=neo4j POSTGRES_URL=... yarn start --entryFile core/cutover.run -- --only=tool

# full load (migrates the target first, then loads)
DATABASE=neo4j POSTGRES_URL=... yarn start --entryFile core/cutover.run
```

Flags: `--dry-run` · `--only=a,b,c` · `--batch=N` (default 500) · `--no-migrate`.

### What a dry-run does and does not prove

`--dry-run` validates **reads, hydration and mapping**. It does **not** touch the
database: `bulkInsert` returns early before inserting, and the harness sets
`count = inserted` with `ok = true` unconditionally, so its ✓ column *cannot
fail*. It therefore proves nothing about NOT NULL, CHECK, FK or unique-index
satisfaction.

Every new wave needs a **real run against a throwaway database** to be called
verified — that is the only thing that exercises the constraints. Two real FK
bugs (`auth_identities`, `user_organizations`) and three unique-drop mismatches
were invisible to dry-runs and surfaced on the first real scratch run.

```bash
psql -U postgres -c 'DROP DATABASE IF EXISTS cutover_scratch'
psql -U postgres -c 'CREATE DATABASE cutover_scratch'
DATABASE=neo4j POSTGRES_URL=postgresql://postgres:postgres@localhost:5432/cutover_scratch \
  yarn start --entryFile core/cutover.run
```

### `--only` and the CASCADE truncate

The truncate is `TRUNCATE <targets> RESTART IDENTITY CASCADE`, so it also empties
tables holding an FK *to* a target even when that table belongs to an unselected
extractor. `--only=language` alone wipes `ethnologue_languages` (its
`language_id` references `languages.id`) and then has nothing to backfill. Select
dependencies explicitly: `--only=ethnologue,language`.

The load is **idempotent**: it TRUNCATEs every target table (CASCADE) before
loading, so dry-runs and retries start clean. Inserts use `onConflictDoNothing`.

**Reconciliation** (printed at the end): `read` = rows pulled from Neo4j,
`inserted` = rows sent to Postgres, `pgCount` = rows actually present. A
`read`/`pgCount` gap means `onConflictDoNothing` dropped rows on a UNIQUE
conflict — **investigate, don't ignore**.

## Cutover runbook (production)

1. Freeze Neo4j writes (maintenance window) + take a final snapshot.
2. Point `POSTGRES_URL` at the fresh target; run the full load.
3. Check the reconciliation report — every table `✓`, no dropped-row gaps.
4. Flip `DATABASE=postgres`; smoke-test.
5. Keep Neo4j as read-only fallback for a few days, then tear down.

Rollback is instant at any point before the flip: Neo4j is untouched.

## Findings (surfaced by the real-load validation — real cutover concerns)

1. **Null in NOT-NULL columns.** Legacy rows can lack a `Property` the DTO types
   as non-null (`users.status`, `partners.active`/`globalInnovationsClient`).
   Handled with `orDefault(...)` → the schema default. Audit for more before prod.
2. **Dangling references (live → deleted).** A live row can reference a
   soft-deleted/absent target (`locations.defaultMarketingRegion`). The self-FK
   two-pass skips targets not actually present. **Open decision for prod:**
   migrate soft-deleted parents too, or scrub these refs. NOT-NULL dangling FKs
   (e.g. a partner's org) can't be nulled — they'd need the parent migrated or
   the row skipped.
3. **Dropped rows on UNIQUE conflicts.** Dev Neo4j has duplicate live location
   names → `onConflictDoNothing` dropped 9 (reconciliation flagged read 26 /
   pgCount 17). Prod needs dedup or the partial-unique relaxed.
4. **Legacy/renamed enum values.** Neo4j `organizations.types` carries
   `TranslationOrganization`, absent from the PG `organization_type` enum.
   `sanitizeEnum` currently **drops** unknowns (logged). **migration-todo:** some
   are renames that should MAP (likely `TranslationOrganization` → `Translation`)
   — replace the drop with an explicit per-enum value map once the team decides.
5. **`deleted_at` rows.** `readMany` returns live rows only; soft-deleted nodes
   aren't carried. Confirm that's intended per domain before cutover.

## Domains covered (firm / merged to develop)

user (+ global_roles, educations, unavailabilities, system_agents,
auth_identities) · tool · fundingAccount · ethnologue · departmentIdBlock ·
fieldZone · fieldRegion · location · organization (+ 2 junctions) · partner
(+ 3 junctions) · project (+ workflow events, step re-assert 2-pass) ·
projectMember · partnership · notification (+ recipients) · budget
(+ budget_records).

**Deliberately NOT migrated (transient):** `auth_sessions`,
`auth_password_reset_tokens` — users re-authenticate post-cutover.

## Not covered yet (add as domains land / as follow-ups)

- **File + Media** — deferred. `file_nodes` is a single-table tree needing a
  topological insert (parents before children) + a two-pass for the denormalized
  `latest_version_id`; Media's app-level port isn't on develop. Wants its own
  focused pass. (S3 blobs never migrate — metadata only.)
- **Language / Engagement** and all later-wave domains — add an extractor here
  as each lands on develop (that's the "build the data script incrementally"
  plan). New extractors just implement `Extractor` and register in `index.ts`;
  the harness handles ordering + reconciliation.
- **`ethnologue_languages.language_id`** — left null (deferred FK); backfill in
  the Language wave.
