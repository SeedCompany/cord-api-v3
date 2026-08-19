# Cutover ETL — Neo4j → Postgres

One-time data migration run at cutover: reads every entity out of **Neo4j** (the
production DB) and inserts it into the corresponding **Postgres** (Drizzle)
tables, **ID-preserving**, with **no service/hook side-effects**. Separate from
the schema migrations (those build empty tables; this fills them).

> Status: **all 55 loadable tables covered (the 3 remaining are uncoverable by
> design — see below).** Built + validated end-to-end against a local Neo4j
> (`yarn` dev DB). NOT yet run against production data. See _Findings_ and
> _Not covered_.

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

## Pre-flight: `preflight-enums.cypher` — RUN THIS AGAINST PROD FIRST

40 read-only legs covering stored enum values that have to fit a Postgres enum.

⚠ **The allowed lists are hand-maintained, and the leg list is NOT complete.**
This section used to claim the lists were "generated from `drizzle/schema`, so they
cannot drift" — there is no generator, and they can. Two consequences to hold:

- Each leg's allowed list is a copy of a `pgEnum`'s values at the time it was
  written. Re-check a leg against `schema/index.ts` before trusting it.
- Columns with **no leg at all** are the bigger gap, because a missing leg looks
  exactly like a clean one. Known-missing: `projects.type`,
  `department_id_blocks.programs`, `engagements.using_ai_assisted_translation`,
  `products.methodology`, `products.progress_step_measurement`,
  `product_completion_descriptions.methodology`,
  `partnership_producing_mediums.medium`, `project_workflow_events.to_step`.
  Add them before relying on this as a full sweep.

A leg was added for `Engagement.status (superseded/history)`: the live-status leg
scans `{active: true}` only, so it cannot see the retired values that
`engagement_status_history` now migrates — a status retired years ago exists
nowhere else.

```bash
# against a local container
docker exec -i <neo4j-container> cypher-shell -u neo4j -p <pw> --format plain \
  < src/core/cutover/preflight-enums.cypher

# against a remote (prod/staged) instance, using a container's client binary so
# nothing needs installing locally — `-a` targets the address
docker exec -i <neo4j-container> cypher-shell -a neo4j+s://<host> -u <user> -p <pw> \
  --format plain < src/core/cutover/preflight-enums.cypher
```

Rows are ordered so anything wrong is at the top. Two signals:

- **`wouldDrop` non-empty** — the source holds a value the target enum does not
  declare. For a sanitised column the row still lands *without* that value, which
  no row count can show. For an unsanitised one the cast fails and the load stops.
- **`distinctValues = 0`** — the leg matched nothing. Treat as a WRONG LEG first
  and an empty domain second. That convention immediately caught one: media
  category is stored **on the node**, and the leg was written as a `Property` node
  walk, so it read 0 while holding values.

Storage shape is stated per row because a sweep that only walks `Property` nodes
misses every enum held on the node itself (progress summary period, step progress
step, workflow event status, media category) or on a relationship (known-language
proficiency). All three shapes exist; only the first is obvious.

Expected on production, from a value dump taken 2026-08-05: every leg above should
report `distinctValues > 0` **except** possibly `KnownLanguage.proficiency`, which
is the one leg no run has yet exercised. A zero anywhere else means the leg is
wrong, not that the data is empty.

## Pre-flight: `preflight-uniques.cypher` — RUN THIS AGAINST PROD FIRST

22 read-only legs, Tier 1 (root entities, where a drop takes a subtree) then Tier 2
(junctions, one row each).

⚠ **Not one leg per shed-capable index — eight enforced unique indexes have no leg**,
and a missing leg is indistinguishable from a clean one. Missing:
`periodic_reports_live_interval_unique`, `media_file_version_id_unique`,
`prompt_variant_response_entries_response_variant_active_unique`,
`product_progress_product_report_variant_unique`, `step_progress_progress_step_unique`,
`tool_usages`' natural key, and the two `user_organizations` /
`progress_report_media` variant keys. Five of those shed a row at load with only an
unattributed read-vs-inserted gap to show for it. Worth closing before the prod
dry-run; until then, do not read a clean sweep as "no duplicates anywhere".

```bash
docker exec -i <neo4j-container> cypher-shell -u neo4j -p <pw> --format plain \
  < src/core/cutover/preflight-uniques.cypher
```

Columns: `scannedKeys` (distinct live key values — **zero means a BROKEN LEG, not a
clean result**), `dupGroups`, `rowsWouldDrop`. On a Tier 1 row read
`rowsWouldDrop` as a **subtree**, not a row count — see findings #6 and #9.

Three conventions in this file exist because each one caught a real bug:

- **Aggregate to scalars first, attach the leg's label literal after.** A literal
  in the aggregating clause is a grouping key, and a grouping key over zero input
  rows yields zero output rows — so a clean leg would vanish and read exactly like
  a broken pattern.
- **`scannedKeys: 0` is a broken leg.** That convention immediately caught one:
  the `user_organizations` primary check tested `r.primary = true` on the
  `organization` edge, but primary is a **separate `primaryOrganization` relationship
  type**.
- **Never group by `labels(n)[i]`.** For producibles `labels(n)[0]` is `"BaseNode"`
  (`["BaseNode","Story","Producible"]`), so grouping by it would fold a Film and a
  Story sharing a name into one group and report a **false** duplicate. Use an
  explicit `CASE WHEN n:Film …`.

Validated against local data: every leg matches real rows, and its predictions
reproduced what the loader actually dropped (`iso_alpha3` → 9 locations,
ethnologue `code` + `provisional_code` → 2).

**Those three legs no longer predict anything.** Migration 0030 dropped their
unique indexes — along with the language `name` / `display_name` pair — because
Neo4j never enforced any of them, so Postgres was rejecting data the source
accepts. Their legs are relabelled `RELAXED 0030, informational` and kept for the
duplicate count alone. A ROLV-code leg was added in the same pass: it is the one
language unique still enforced, and it had no leg at all, so the instrument was
measuring three constraints that no longer drop and missing the one that does.
Locally it reads 8 keys / 0 duplicates, and production reads 3,430 / 0.

## Cutover runbook (production)

> **The harness REFUSES to read an unscrubbed production-scale graph, and that is
> not bypassable from the command line.** `runCutover` calls `checkScrubGate`
> before anything else (in the harness, not the entry point, so no caller can skip
> it), and it rejects any graph of ≥1,000,000 nodes that carries no current
> `DataProvenance` scrub marker. Production is ~22M nodes. Discovering this inside
> the maintenance window means burning the window, so settle the source question
> BEFORE the freeze — either run against a scrubbed copy, or agree the marker
> story for the real load in advance. Do not add an env-var bypass.

0. **Run the pre-flight probes** (below) against production and read the results.
   These size the losses in advance; several classes are invisible until they have
   already happened.
1. Freeze Neo4j writes (maintenance window) + take a final snapshot. The event
   tables grow continuously, so a copy taken while writes continue will not match
   what was validated.
2. Point `POSTGRES_URL` at the fresh target; run the full load with
   `DATABASE=neo4j` and `--batch=100`.
3. Check the reconciliation report — every table `✓`, no dropped-row gaps, and the
   "Not hydrated" block empty. The process now exits non-zero on a MISMATCH, and
   `--strict` also fails the run when any row was lost, so this step can be
   automated rather than read by eye.
4. Flip `DATABASE=postgres`; smoke-test.
5. Keep Neo4j as read-only fallback for a few days, then tear down.

Rollback is instant at any point before the flip: Neo4j is untouched — and the
run deliberately disables root-object sync and index creation so that stays true
(booting the AppModule would otherwise write to the source graph in the
background).

### Cheap probes worth running at immediate pre-flight

All are O(1) or near it, and each answers "is there data here we do not migrate,
or that would stop the load?"

```cypher
// Field zones / regions: director and zone are OPTIONAL in Neo4j and NOT NULL in
// Postgres, so a missing one stops the load. The extractors now fail fast naming
// the ids rather than letting the driver reject a null mid-run. These are small
// tables, so this should read 0 -- the point is to know before the window.
// `scanned` is reported so a 0 cannot be confused with a query that matched
// nothing.
MATCH (z:FieldZone)
WITH count(z) AS total,
     sum(CASE WHEN EXISTS { MATCH (z)-[:director { active: true }]->(:User) } THEN 0 ELSE 1 END) AS broken
RETURN 'FieldZone.director' AS check, total AS scanned, broken AS wouldFailLoad
UNION ALL
MATCH (r:FieldRegion)
WITH count(r) AS total,
     sum(CASE WHEN EXISTS { MATCH (r)-[:director { active: true }]->(:User) } THEN 0 ELSE 1 END) AS broken
RETURN 'FieldRegion.director' AS check, total AS scanned, broken AS wouldFailLoad
UNION ALL
MATCH (r:FieldRegion)
WITH count(r) AS total,
     sum(CASE WHEN EXISTS { MATCH (r)-[:zone { active: true }]->(:FieldZone) } THEN 0 ELSE 1 END) AS broken
RETURN 'FieldRegion.zone' AS check, total AS scanned, broken AS wouldFailLoad
```

⚠ The region-to-zone relationship is `:zone`, NOT `:fieldZone` -- `fieldZone` is
the DTO field name only. Matching the DTO name here would report a clean 0 while
scanning nothing.

```cypher
// Webhooks: no extractor exists because prod has no webhook data (2026-08-18).
// This is a point-in-time fact — if the feature gets used before the flip, that
// data would be silently left behind.
MATCH (n:Webhook) RETURN count(n);

// Tool-usage containers: container_type is NOT NULL and is resolved through
// resolveParentTypes, which covers only progress report / engagement / project /
// partner / language / user. A usage on any other resource type is DROPPED. This
// reports what container types actually exist, so the gap can be sized before the
// load rather than counted in its warnings.
MATCH (:ToolUsage)-[:container]->(c)
RETURN [l IN labels(c) WHERE NOT l STARTS WITH 'Deleted_' AND l <> 'BaseNode'] AS containerLabels,
       count(*) AS usages
ORDER BY usages DESC;
```

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
3. **Dropped rows on UNIQUE conflicts.** ✅ **CLOSED by migration 0030** — the five
   offending indexes are gone (language `name` + `display_name`, ethnologue `code`
   + `provisional_code`, `locations.iso_alpha3`), because Neo4j never enforced any
   of them. A full local load now reports `locations 26/26`, `languages 69/69` and
   `ethnologue_languages 69/69`, where it previously shed 9 locations and 19
   languages plus their ~1,400-row subtree. Total drops on that dataset fell from
   ~1,500 to 206, and every remaining drop is a genuine soft-deleted-parent case
   rather than a constraint the source does not have.
   *History, kept because the reasoning is the lesson:*
   `onConflictDoNothing` dropped 9 locations (reconciliation flagged read 26 /
   pgCount 17).
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
4. **Legacy/renamed enum values — CHECKED AND CLEAR.** `sanitizeEnum` drops
   values the target pgEnum does not declare, which raised the question of
   whether any stored value is a rename that should be mapped instead. Every
   enum-bearing property in production was compared against the pgEnum that
   receives it: **no stored value would be dropped.** The one renamed value that
   prompted the concern turned out to exist only in local test data. No value map
   is needed. Note the reverse case, though: enum columns whose extractor does
   not call `sanitizeEnum` cast straight through, so an unknown value there fails
   the load instead of being dropped — a different failure to recognise.
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
9. **🔴 A dropped row can break a whole LIST QUERY, not just lose data (ETH1).**
   The worst consequence found so far, and it is qualitatively different from
   finding #6's subtree arithmetic. The 2 `ethnologue_languages` rows dropped to
   the `code` / `provisional_code` unique indexes leave their 2 languages with no
   ethnologue row — and the Postgres language repo treats that as a hard
   invariant: *"Language iaJWie869fn has no attached EthnologueLanguage —
   create-flow invariant violated"*. Neo4j tolerates the same shape and answers
   normally. Measured by the shadow-diff run of 2026-07-30: this **fails
   `languages.list` outright for an Administrator** — the entire query, not one
   row — plus `engagement.byId` for any engagement on an affected language.
   So the ordering of consequences for a unique-dup drop is: (1) the row, (2) its
   subtree, (3) **any query whose result set would have contained it, if a
   downstream repo asserts an invariant the source never enforced.** Prod exposure
   is unmeasured; the `ethnologue.code` / `provisionalCode` legs of the unique
   pre-flight are what size it, and they must be run before the dry-run window.
10. **Alias every expression column in a raw `sql` leg.** `resolveParentTypes`
   shipped with `AS t` on only its first leg; Postgres names an unaliased
   expression `?column?`, so five of six legs mapped their ids to `undefined`.
   That still created the map KEY, which defeated the `keepLanded` guard built
   from `.keys()` and then failed on a NOT NULL discriminator. Caught by a real
   run — invisible to a dry-run, which never inserts. The helper now skips falsy
   values so an alias slip can only lose a row loudly, never write a null.

## Domains covered (firm / merged to develop)

**58 of 61 Postgres tables, which is the ceiling — see below.**

(2026-08-14: `user_locations`, `language_locations`, and
`project_other_locations` are three NEW junction tables — the app-side
`addLocationToNode`/`removeLocationFromNode` gap they fill was found and
fixed on `location-node-edges-postgres`, not yet on develop. This count and
the extractors below assume that migration has landed; until this branch is
rebased past it, `userLocation`/`language`/`project`'s new Cypher legs
reference tables that don't exist in the schema on disk yet — see those
commits for detail.)

user (+ global_roles, educations, unavailabilities, system_agents,
auth_identities) · **userLocation** (`user_locations`) · tool ·
fundingAccount · ethnologue · language (+ **locations** junction) ·
departmentIdBlock · fieldZone · fieldRegion · location · organization
(+ 2 junctions) · partner (+ 3 junctions) · project (+ workflow events, step
re-assert 2-pass, **otherLocations** junction) · projectMember · partnership ·
engagement (+ status history, ceremonies) · product (+ producibles, completion
descriptions) · periodic-report · prompt-variant-response (+ entries) ·
product-progress (+ step progress) · progress-summary · notification
(+ recipients) · budget (+ budget_records) · pin · known-language · comment
(+ threads) · post · file (+ media, PnP extraction results + problems,
progress-report media) · tool-usage · progress-report-workflow-event ·
progress-report-variance-explanation · partnership-producing-medium.

`project.rootDirectoryId` and `engagement.{pnpId,growthPlanId}` are backfilled
from the DTO fields the live repos already hydrate (`rootDirectory` relation,
`props.pnp`/`props.growthPlan`) now that `file` is a declared dependency of
both — no separate second pass needed, the id was sitting on the row the
whole time.

## Not covered (by design — this is the correct end state, not a gap)

- **`auth_sessions`, `auth_password_reset_tokens`** — transient; users
  re-authenticate post-cutover.
- **`resource_mutations`** — the audit log. Postgres-only surface with no
  Neo4j counterpart to read; starts empty and accumulates from the first
  post-flip mutation. Writing an extractor for it isn't hard, it's impossible.
- **The four webhook tables** (migration 0037) — **prod carries no webhook data**
  (confirmed 2026-08-18), so there is nothing to move. Deliberately skipped-empty
  rather than uncovered, and the same category as `known-language`: unproven code
  that would move zero rows costs nothing at cutover. ⚠ Point-in-time, so the
  count probe in the runbook above is worth one second at immediate pre-flight.

Do not chase 58/58 — the items above cannot and should not be filled from
Neo4j.

## Thin/unexercised paths worth a second look with real data

- **ProgressReportHighlight** exists as a code path in the
  prompt-variant-response extractor but has **zero instances locally**, so that
  branch is written and unexercised. Same class as OtherProduct / Film /
  EthnoArt and `engagement_status_history` — needs a real dataset to validate.
