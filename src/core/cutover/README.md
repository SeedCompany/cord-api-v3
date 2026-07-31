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

Each statement needs its own `-c`: you cannot DROP/CREATE a database inside a
multi-statement (implicitly transactional) batch. There is no local `psql` on the
dev machine — it lives in the compose container.

```bash
docker exec cord-api-v3-postgres-1 psql -U postgres -c 'DROP DATABASE IF EXISTS cutover_scratch'
docker exec cord-api-v3-postgres-1 psql -U postgres -c 'CREATE DATABASE cutover_scratch'
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
3. **Dropped rows on UNIQUE conflicts.** `onConflictDoNothing` drops 9 locations
   (reconciliation flags read 26 / pgCount 17). Prod needs dedup or the
   partial-unique relaxed.
   **Corrected 2026-07-30 — this finding named the wrong column for weeks.** The
   culprit is `locations_iso_alpha3_active_unique`, NOT
   `locations_name_active_unique`: live location names have **zero** duplicates
   locally (26 distinct over 26 rows), while `iso_alpha3` has 3 distinct non-null
   values spread over 12 rows — exactly the 9 drops observed. The index carries no
   `NULLS NOT DISTINCT`, so Postgres treats NULLs as distinct and the 19 null-coded
   locations do not collide; only the non-null groups do, which is why the non-null
   count matches the drop count precisely.
   The general lesson is bigger than the typo: **attribute a drop to a named
   constraint by measuring that constraint's key, not by assuming.** Two of these
   findings have now blamed a name column that turned out innocent (see the
   language case in finding #6 / migration 0030). A per-constraint pre-flight
   query is the instrument; a plausible guess is not.
4. **Legacy/renamed enum values.** Neo4j `organizations.types` carries
   `TranslationOrganization`, absent from the PG `organization_type` enum.
   `sanitizeEnum` currently **drops** unknowns (logged). **migration-todo:** some
   are renames that should MAP (likely `TranslationOrganization` → `Translation`)
   — replace the drop with an explicit per-enum value map once the team decides.
5. **`deleted_at` rows.** `readMany` returns live rows only; soft-deleted nodes
   aren't carried. Confirm that's intended per domain before cutover.
6. **A drop at the root is not a drop of one row — measure the subtree.** The
   19 languages lost to finding #3 locally cost, transitively: 32
   LanguageEngagements → 32 ceremonies → 88 products → **514 periodic reports**
   → 148 product-progress rows → 605 step-progress rows → 18 progress
   summaries. Roughly 1,400 rows from 19. Per-table reconciliation reports each
   of these as its own ⚠, which reads like seven unrelated problems rather than
   one; the "counts reconcile but N dropped" summary line exists to stop that
   being mistaken for a clean load. **Fix the root before the dry run**, and
   re-measure downstream after: the deeper waves are where the loss shows up,
   and they did not exist when finding #3 was first written.
7. **A repository can be the wrong reader — read its `hydrate`/`readMany` first.**
   `PostRepository.readMany` applies `filterAuthorized()`, which is not a policy
   check but hardcoded Cypher requiring the current user to be a **member** of the
   post's parent. A root session cannot satisfy a graph traversal, so every
   `Membership`-shareability post would be silently dropped — the read stat counts
   only what came back. Post is therefore read by raw Cypher.
   The distinction that keeps this narrow: every *other* filtered repository uses
   `privileges.filterToReadable()`, which root's global grants DO satisfy —
   confirmed empirically, since project / engagement / language each read their
   full node count through `readMany`. **Local data cannot catch this class:** all
   8 local posts are `Internal`, so the filter drops nothing here; a prod run is
   where it would have bitten.
   Same family, different mechanism: `CommentThreadRepository.hydrate` returns only
   `[comments[0], comments[-1]]`, so reading comments through the *thread* repo
   would migrate two per thread and discard the middle of every conversation.
8. **Edge-stored domains need their own guard.** Pins and known languages have no
   node label to enumerate — they are `(:User)-[:pinned]->(:BaseNode)` and
   `(:User)-[:knownLanguage { value }]->(:Language)`. `warnIfLabelUnknown` cannot
   see a relationship type, so a misspelled one returns zero rows and reconciles ✓
   — the ethnologue failure in a dimension the existing guard is blind to.
   `warnIfRelTypeUnknown` closes it and earned its place on its first run:
   `knownLanguage` has **zero** edges locally, so a correct query and a typo
   produce byte-identical output and nothing else could distinguish them.
9. **Alias every expression column in a raw `sql` leg.** `resolveParentTypes`
   shipped with `AS t` on only its first leg; Postgres names an unaliased
   expression `?column?`, so five of six legs mapped their ids to `undefined`.
   That still created the map KEY, which defeated the `keepLanded` guard built
   from `.keys()` and then failed on a NOT NULL discriminator. Caught by a real
   run — invisible to a dry-run, which never inserts. The helper now skips falsy
   values so an alias slip can only lose a row loudly, never write a null.

## Domains covered (firm / merged to develop)

user (+ global_roles, educations, unavailabilities, system_agents,
auth_identities) · tool · fundingAccount · ethnologue · language ·
departmentIdBlock · fieldZone · fieldRegion · location · organization
(+ 2 junctions) · partner (+ 3 junctions) · project (+ workflow events, step
re-assert 2-pass) · projectMember · partnership · engagement (+ status history,
ceremonies) · product (+ producibles, completion descriptions) · periodic-report
· prompt-variant-response (+ entries) · product-progress (+ step progress) ·
progress-summary · notification (+ recipients) · budget (+ budget_records) ·
pin · known-language · comment (+ threads) · post.

**Deliberately NOT migrated (transient):** `auth_sessions`,
`auth_password_reset_tokens` — users re-authenticate post-cutover.

## Not covered yet (add as domains land / as follow-ups)

- **File + Media** — deferred. `file_nodes` is a single-table tree needing a
  topological insert (parents before children) + a two-pass for the denormalized
  `latest_version_id`. Wants its own focused pass. (S3 blobs never migrate —
  metadata only.) Note `periodic_reports.report_file_id`/`narrative_file_id`
  ARE already populated with the ids this wave will insert — they're plain text
  with no FK, so they cost nothing to carry early and save a backfill.
- **progress-report media + PnP extraction results** — both are file-keyed, so
  they belong with the File wave rather than with the other leaves.
- **ProgressReportWorkflowEvent** (192 nodes locally) and
  **ProgressReportVarianceExplanation** (2) have **no Postgres table yet** —
  neither domain is ported, so there is nowhere to load them. A progress
  report's *current* `status` carries over; its transition history does not.
  Add extractors when those domains land.
- **ProgressReportHighlight** exists as a code path in the
  prompt-variant-response extractor but has **zero instances locally**, so that
  branch is written and unexercised. Same class as OtherProduct / Film /
  EthnoArt and `engagement_status_history` — needs a real dataset to validate.
