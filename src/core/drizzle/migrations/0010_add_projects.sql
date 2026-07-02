-- Migration: add Project + ProjectMember + ProjectWorkflowEvent.
-- Plus the supporting enums and the trigger that keeps `projects.step` in
-- sync with `project_workflow_events`.
--
-- Settled design decisions (see migration_postgres.md → Project Domain Notes):
--   - Single-table inheritance over MomentumTranslation / MultiplicationTranslation /
--     Internship; `type` discriminator; `own_sensitivity` is meaningful only for
--     Internship rows.
--   - `sensitivity` is denormalized — kept current via a hook that wires when
--     Language migrates (Tier 2). Translation rows read 'High' until then.
--   - `status` is GENERATED ALWAYS AS (CASE step ... END) STORED — mirrors
--     stepToStatus() in src/components/project/dto/project-status.enum.ts and
--     Gel's Project::statusFromStep(.step). Never writable.
--   - `project_members.roles` is `role[]` (pgEnum array) with a GIN index;
--     `roles && ARRAY[...]::role[]` powers the intersectsProp filter.
--   - Workflow → step sync via AFTER INSERT trigger on project_workflow_events.

CREATE TYPE "project_step" AS ENUM (
  'EarlyConversations',
  'PendingConceptApproval',
  'PrepForConsultantEndorsement',
  'PendingConsultantEndorsement',
  'PrepForFinancialEndorsement',
  'PendingFinancialEndorsement',
  'FinalizingProposal',
  'PendingRegionalDirectorApproval',
  'PendingZoneDirectorApproval',
  'PendingFinanceConfirmation',
  'OnHoldFinanceConfirmation',
  'DidNotDevelop',
  'Rejected',
  'Active',
  'ActiveChangedPlan',
  'DiscussingChangeToPlan',
  'PendingChangeToPlanApproval',
  'PendingChangeToPlanConfirmation',
  'DiscussingSuspension',
  'PendingSuspensionApproval',
  'Suspended',
  'DiscussingReactivation',
  'PendingReactivationApproval',
  'DiscussingTermination',
  'PendingTerminationApproval',
  'FinalizingCompletion',
  'Terminated',
  'Completed'
);
--> statement-breakpoint

CREATE TYPE "project_status" AS ENUM (
  'InDevelopment',
  'Active',
  'Terminated',
  'Completed',
  'DidNotDevelop'
);
--> statement-breakpoint

CREATE TYPE "report_period" AS ENUM ('Monthly', 'Quarterly');
--> statement-breakpoint

-- First DB-typed role enum. `user_global_roles.role` predates this and is plain
-- `text` — aligning that column is a separate cleanup PR (out of scope here).
CREATE TYPE "role" AS ENUM (
  'Administrator',
  'BetaTester',
  'BibleTranslationLiaison',
  'Consultant',
  'ConsultantManager',
  'Controller',
  'ExperienceOperations',
  'FieldOperationsDirector',
  'FieldPartner',
  'FieldServices',
  'FinancialAnalyst',
  'Fundraising',
  'Intern',
  'LeadFinancialAnalyst',
  'Leadership',
  'Liaison',
  'Marketing',
  'Mentor',
  'MultiplicationFinanceApprover',
  'ProjectManager',
  'RegionalCommunicationsCoordinator',
  'RegionalDirector',
  'StaffMember',
  'Translator'
);
--> statement-breakpoint

CREATE TABLE "projects" (
  "id"                             text                PRIMARY KEY,
  "type"                           "project_type"      NOT NULL,
  "name"                           text                NOT NULL,
  "step"                           "project_step"      NOT NULL DEFAULT 'EarlyConversations',
  -- Mirror of stepToStatus() — never writable.
  "status"                         "project_status"    NOT NULL GENERATED ALWAYS AS (
    CASE "step"
      WHEN 'EarlyConversations'              THEN 'InDevelopment'::project_status
      WHEN 'PendingConceptApproval'          THEN 'InDevelopment'::project_status
      WHEN 'PrepForConsultantEndorsement'    THEN 'InDevelopment'::project_status
      WHEN 'PendingConsultantEndorsement'    THEN 'InDevelopment'::project_status
      WHEN 'PrepForFinancialEndorsement'     THEN 'InDevelopment'::project_status
      WHEN 'PendingFinancialEndorsement'     THEN 'InDevelopment'::project_status
      WHEN 'FinalizingProposal'              THEN 'InDevelopment'::project_status
      WHEN 'PendingRegionalDirectorApproval' THEN 'InDevelopment'::project_status
      WHEN 'PendingZoneDirectorApproval'     THEN 'InDevelopment'::project_status
      WHEN 'PendingFinanceConfirmation'      THEN 'InDevelopment'::project_status
      WHEN 'OnHoldFinanceConfirmation'       THEN 'InDevelopment'::project_status
      WHEN 'DidNotDevelop'                   THEN 'DidNotDevelop'::project_status
      WHEN 'Rejected'                        THEN 'DidNotDevelop'::project_status
      WHEN 'Active'                          THEN 'Active'::project_status
      WHEN 'ActiveChangedPlan'               THEN 'Active'::project_status
      WHEN 'DiscussingChangeToPlan'          THEN 'Active'::project_status
      WHEN 'PendingChangeToPlanApproval'     THEN 'Active'::project_status
      WHEN 'PendingChangeToPlanConfirmation' THEN 'Active'::project_status
      WHEN 'DiscussingSuspension'            THEN 'Active'::project_status
      WHEN 'PendingSuspensionApproval'       THEN 'Active'::project_status
      WHEN 'Suspended'                       THEN 'Active'::project_status
      WHEN 'DiscussingReactivation'          THEN 'Active'::project_status
      WHEN 'PendingReactivationApproval'     THEN 'Active'::project_status
      WHEN 'DiscussingTermination'           THEN 'Active'::project_status
      WHEN 'PendingTerminationApproval'      THEN 'Active'::project_status
      WHEN 'FinalizingCompletion'            THEN 'Active'::project_status
      WHEN 'Terminated'                      THEN 'Terminated'::project_status
      WHEN 'Completed'                       THEN 'Completed'::project_status
    END
  ) STORED,
  -- migration-todo: denormalized — recompute hook fires when Engagement/Language
  -- sensitivity changes (Tier 2 Language migration wires the hook). Translation
  -- rows read 'High' until then; Internship reads own_sensitivity.
  "sensitivity"                    "sensitivity"       NOT NULL DEFAULT 'High',
  "own_sensitivity"                "sensitivity",
  "rev79_project_id"               text,
  "department_id"                  text,
  "department_id_block_id"         text                REFERENCES "department_id_blocks"("id"),
  "primary_location_id"            text                REFERENCES "locations"("id"),
  "marketing_location_id"          text                REFERENCES "locations"("id"),
  "marketing_region_override_id"   text                REFERENCES "locations"("id"),
  "field_region_id"                text                REFERENCES "field_regions"("id"),
  "owning_organization_id"         text                REFERENCES "organizations"("id"),
  -- Real FK → file_nodes(id). File is on develop (0008); wired now rather than
  -- deferred. AttachProjectRootDirectoryHandler's PG path back-fills it.
  "root_directory_id"              text                REFERENCES "file_nodes"("id"),
  "mou_start"                      date,
  "mou_end"                        date,
  "initial_mou_end"                date,
  "estimated_submission"           date,
  "financial_report_received_at"   timestamptz,
  "financial_report_period"        "report_period",
  "tags"                           text[]              NOT NULL DEFAULT '{}',
  "preset_inventory"               boolean             NOT NULL DEFAULT false,
  "created_at"                     timestamptz         NOT NULL DEFAULT now(),
  "modified_at"                    timestamptz         NOT NULL DEFAULT now(),
  "updated_at"                     timestamptz         NOT NULL DEFAULT now(),
  "deleted_at"                     timestamptz
);
--> statement-breakpoint

-- Partial uniques — only enforced on live (non-soft-deleted) rows.
CREATE UNIQUE INDEX "projects_name_active_unique"
  ON "projects" ("name") WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "projects_department_id_active_unique"
  ON "projects" ("department_id")
  WHERE "department_id" IS NOT NULL AND "deleted_at" IS NULL;
--> statement-breakpoint

-- FK b-tree indexes — PG doesn't auto-index FKs.
CREATE INDEX "projects_department_id_block_id_idx"      ON "projects" ("department_id_block_id");
--> statement-breakpoint
CREATE INDEX "projects_primary_location_id_idx"         ON "projects" ("primary_location_id");
--> statement-breakpoint
CREATE INDEX "projects_marketing_location_id_idx"       ON "projects" ("marketing_location_id");
--> statement-breakpoint
CREATE INDEX "projects_marketing_region_override_id_idx" ON "projects" ("marketing_region_override_id");
--> statement-breakpoint
CREATE INDEX "projects_field_region_id_idx"             ON "projects" ("field_region_id");
--> statement-breakpoint
CREATE INDEX "projects_owning_organization_id_idx"      ON "projects" ("owning_organization_id");
--> statement-breakpoint
-- FK b-tree index (PG doesn't auto-index FKs).
CREATE INDEX "projects_root_directory_id_idx"           ON "projects" ("root_directory_id");
--> statement-breakpoint
-- Filter-hot columns.
CREATE INDEX "projects_type_idx"   ON "projects" ("type");
--> statement-breakpoint
CREATE INDEX "projects_step_idx"   ON "projects" ("step");
--> statement-breakpoint
CREATE INDEX "projects_status_idx" ON "projects" ("status");
--> statement-breakpoint

CREATE TABLE "project_members" (
  "id"          text         PRIMARY KEY,
  "project_id"  text         NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "user_id"     text         NOT NULL REFERENCES "users"("id")    ON DELETE CASCADE,
  "roles"       "role"[]     NOT NULL DEFAULT '{}',
  "inactive_at" timestamptz,
  "created_at"  timestamptz  NOT NULL DEFAULT now(),
  "updated_at"  timestamptz  NOT NULL DEFAULT now(),
  "deleted_at"  timestamptz
);
--> statement-breakpoint

CREATE UNIQUE INDEX "project_members_project_user_active_unique"
  ON "project_members" ("project_id", "user_id") WHERE "deleted_at" IS NULL;
--> statement-breakpoint
-- Full FK index on project_id — the partial unique above excludes soft-deleted
-- rows, so PG can't use it for FK maintenance / ON DELETE CASCADE over all
-- children (incl. soft-deleted).
CREATE INDEX "project_members_project_id_idx" ON "project_members" ("project_id");
--> statement-breakpoint
CREATE INDEX "project_members_user_id_idx" ON "project_members" ("user_id");
--> statement-breakpoint
-- GIN index for `roles && ARRAY[...]::role[]` (intersectsProp filter).
CREATE INDEX "project_members_roles_gin" ON "project_members" USING gin ("roles");
--> statement-breakpoint

CREATE TABLE "project_workflow_events" (
  "id"             text            PRIMARY KEY,
  "project_id"     text            NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "who"            text            NOT NULL REFERENCES "users"("id"),
  -- Nullable for synthetic/initial events; populated for normal transitions.
  "from_step"      "project_step",
  "to_step"        "project_step"  NOT NULL,
  -- Nullable for dynamic transitions (e.g. BackToActive) — they resolve at
  -- runtime from event history and don't carry a static key.
  "transition_key" text,
  "notes"          jsonb,
  "at"             timestamptz     NOT NULL DEFAULT now()
);
--> statement-breakpoint

-- Compound (project_id, at DESC) — every list query is "events for project X,
-- newest first" (mostRecentStep walks the same path).
CREATE INDEX "project_workflow_events_project_id_at_idx"
  ON "project_workflow_events" ("project_id", "at" DESC);
--> statement-breakpoint

-- FK b-tree index on `who` — PG doesn't auto-index FKs; the schema declares
-- this index, so keep the SQL in sync (drift fix vs mono's 0009).
CREATE INDEX "project_workflow_events_who_idx"
  ON "project_workflow_events" ("who");
--> statement-breakpoint

-- Trigger: keep `projects.step` (and modified_at) in sync with the latest
-- event. App code writes events, never touches `projects.step` directly.
-- Mirrors Gel's auto-sync trigger on Project::WorkflowEvent.
--
-- Order-independent by design: only the event that is newest-by-`at` for the
-- project wins, and modified_at takes the event's own `at` (not wall-clock now).
-- This keeps a cutover/backfill that bulk-inserts historical events in any
-- order correct without disabling the trigger — an older event inserted after
-- a newer one won't regress `step`, and modified_at reflects the real
-- transition time rather than the moment of backfill. At runtime the inserted
-- event is always the newest, so behavior is unchanged.
--
-- The "newest" comparison is on the tuple `(at, id)`, not `at` alone, so the
-- winner is deterministic even if two events share an identical `at` (the
-- larger `id` wins). The UPDATE takes a row lock on `projects`; under READ
-- COMMITTED a concurrent transition blocks and re-checks this NOT EXISTS
-- against committed rows after the lock, so max-`(at, id)` always wins
-- regardless of commit order — no explicit FOR UPDATE needed.
CREATE FUNCTION "sync_project_step_from_event"() RETURNS trigger AS $$
BEGIN
  UPDATE "projects"
     SET "step"        = NEW."to_step",
         "modified_at" = NEW."at"
   WHERE "id" = NEW."project_id"
     AND NOT EXISTS (
       SELECT 1 FROM "project_workflow_events" "e"
       WHERE "e"."project_id" = NEW."project_id"
         AND ("e"."at", "e"."id") > (NEW."at", NEW."id")
     );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE TRIGGER "project_workflow_event_synced"
  AFTER INSERT ON "project_workflow_events"
  FOR EACH ROW EXECUTE FUNCTION "sync_project_step_from_event"();
--> statement-breakpoint

