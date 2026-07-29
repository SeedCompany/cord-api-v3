-- Convert periodic_reports from HARD delete to SOFT delete, matching Neo4j.
--
-- Why: Neo4j's `delete()` is a soft relabel (`deleteBaseNode` sets deletedAt and
-- rewrites labels to `Deleted_*`), so shrinking an engagement's date window
-- never destroys anything — a removed report's media, variance explanation and
-- workflow events all survive, merely unreachable. Postgres was doing a REAL
-- DELETE with only Neo4j's `status = NotStarted` eligibility rule, which was
-- never a data-loss guard because in Neo4j it never had to be one. Once 0027
-- gave progress reports media, `progress_report_media`'s NO ACTION FK was the
-- only accidental thing preventing an engagement date change from destroying
-- user uploads (it surfaced as an FK 500 instead). See ledger PC-14.
--
-- Neo4j's create-after-delete behaviour, which this mirrors: the existence check
-- matches `(parent)-[:report {active:true}]->(:ProgressReport)`, which a
-- `Deleted_ProgressReport` node fails, so a brand-new node is created. It even
-- reuses the same deterministic id string, because `prefixNodeLabelsWithDeleted`
-- strips ALL labels before re-adding the prefixed ones — so the soft-deleted
-- node no longer carries the `ProgressReport` label that
-- `createUniqueConstraint(dbLabel, 'id')` is scoped to, and escapes uniqueness
-- entirely. Old row stays soft-deleted with its content; a new live row appears.

ALTER TABLE "periodic_reports" ADD COLUMN "deleted_at" timestamptz;

-- The dedup guarantee has to move off the id.
--
-- Report ids are a deterministic hash of (parent, type, start, end)
-- (`deterministicReportId`), and that determinism WAS the concurrency guard:
-- two transactions computing an id for the same interval landed on the same
-- value, and the PK rejected the loser. Under soft delete the id can be held by
-- a dead row, so a revived interval must insert under a fresh id — at which
-- point the PK no longer dedups anything.
--
-- So the natural key becomes the constraint, partial on liveness per our
-- soft-delete convention: at most one LIVE report per (parent, type, interval),
-- unlimited soft-deleted history behind it.
--
-- Indexed on `coalesce(project_id, engagement_id)` rather than both columns,
-- because indexing both would put a NULL in every row and NULLs compare DISTINCT
-- in a unique index — so two live rows with (NULL, eng, 'Progress', ...) would
-- not collide and the constraint would silently do nothing. The
-- periodic_reports_parent_shape_chk CHECK already guarantees exactly one of the
-- two is non-null, so the coalesce is always the parent id and never null.
-- (`NULLS NOT DISTINCT` would also work on PG >= 15, but this needs no version
-- floor and reads as what it means.)
CREATE UNIQUE INDEX "periodic_reports_live_interval_uniq"
  ON "periodic_reports" (
    (coalesce("project_id", "engagement_id")), "type", "start", "end"
  )
  WHERE "deleted_at" IS NULL;

-- Every read path filters on this; reports are listed by parent + date window.
CREATE INDEX "periodic_reports_deleted_at_idx"
  ON "periodic_reports" ("deleted_at");

-- migration-todo(cutover-etl): prod Neo4j holds `Deleted_*Report` nodes that
-- SHARE an id string with a live report for the same interval (see the label
-- stripping above). Postgres cannot — `id` is the PK. The ETL must therefore
-- either skip soft-deleted reports or re-id them on extract; a naive carry will
-- collide. Same class as ETL finding #3 (unique-dup drops). This is a NEW
-- constraint introduced by this migration — before it, PG had no soft-deleted
-- reports at all, so the question never arose.
