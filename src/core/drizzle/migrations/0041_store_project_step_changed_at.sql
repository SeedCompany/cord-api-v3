-- Store `stepChangedAt` on the project instead of deriving it from the
-- workflow-event trail.
--
-- WHY: Neo4j stores this as a plain property, written whenever the project
-- moves to a new step. Postgres was deriving it at read time from the latest
-- entry in `project_workflow_events`, falling back to `created_at` when a
-- project had no events at all. Those agree for anything that transitioned
-- after the workflow trail began — but the trail only starts 2021-02-13, and
-- 1,560 of 5,284 production projects have no events at all:
--
--   * ~1,081 reached Completed / Terminated / DidNotDevelop BEFORE 2021, so
--     Neo4j holds the real date and Postgres substituted the creation date —
--     wrong by as much as four years, on 991 completed projects.
--   * ~470 old projects still in EarlyConversations have nothing stored in
--     Neo4j at all, so it reports blank while Postgres invented a date.
--
-- Roughly 29% of projects differed on this field. A downstream warehouse
-- comparison found it (Projects.CompletionDate); our own read comparison did
-- not, because it samples the first five projects by id and every legacy
-- record sorts past position 217.
--
-- The derivation cannot be repaired by adjusting the fallback: the history it
-- derives from does not exist for these rows and never will. So the column is
-- carried across from Neo4j verbatim, values and nulls alike.
--
-- migration-todo(post-cutover): Rob's call 2026-08-26 was to match Neo4j now
-- and revisit afterwards. The open question is whether a stored column or a
-- derived value is the right long-term design once the pre-2021 rows are the
-- only ones that need the column. Deriving is arguably cleaner and matches the
-- Gel model (`latestWorkflowEvent.at ?? createdAt`); it just cannot represent
-- history that was never recorded. If it stays stored, the `@Calculated()`
-- decorator on the DTO field is worth revisiting too.
-- ⚠ TWO STEPS ON PURPOSE — do not collapse into `ADD COLUMN ... DEFAULT now()`.
-- Postgres backfills every existing row with the default when the column is
-- added with one. On an already-loaded database that stamps all 1,560
-- no-event projects with the moment the migration ran — every legacy project
-- claiming it changed step today, which is worse than the fallback this
-- replaces. Adding the column bare leaves them NULL, then the default attaches
-- for rows inserted afterwards. Measured: collapsing these gave 1,560 rows a
-- current timestamp.
ALTER TABLE "projects" ADD COLUMN "step_changed_at" timestamp with time zone;
--> statement-breakpoint

-- Nullable on purpose: Neo4j has no value for the ~470 legacy projects that
-- never transitioned, and reports blank for them. Matching that beats
-- inventing a date. The default covers rows the application creates from here
-- on, mirroring Neo4j's `stepChangedAt: now` at creation; an explicit NULL
-- from the loader still overrides it.
ALTER TABLE "projects" ALTER COLUMN "step_changed_at" SET DEFAULT now();
--> statement-breakpoint

-- Backfill anything already loaded, so a database that was migrated before the
-- loader carried this column still reads consistently: latest event if there
-- is one, otherwise leave it NULL rather than guessing.
UPDATE "projects" p
   SET "step_changed_at" = e."at"
  FROM (
    SELECT "project_id", max("at") AS "at"
      FROM "project_workflow_events"
     GROUP BY "project_id"
  ) e
 WHERE e."project_id" = p."id";
--> statement-breakpoint

-- Keep it current the same way `step` is kept current: the trigger that already
-- syncs step from a new event. App code never writes `projects.step` directly
-- and it should not write this either — one place, one rule, and it cannot
-- drift from the event that caused it.
CREATE OR REPLACE FUNCTION "sync_project_step_from_event"() RETURNS trigger AS $$
BEGIN
  UPDATE "projects"
     SET "step"            = NEW."to_step",
         "modified_at"     = NEW."at",
         "step_changed_at" = NEW."at"
   WHERE "id" = NEW."project_id"
     AND NOT EXISTS (
       SELECT 1 FROM "project_workflow_events" "e"
       WHERE "e"."project_id" = NEW."project_id"
         AND ("e"."at", "e"."id") > (NEW."at", NEW."id")
     );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
