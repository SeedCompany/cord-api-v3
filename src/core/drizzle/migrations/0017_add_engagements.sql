-- Engagement + Ceremony domains (Phase 5). Single-table inheritance over
-- LanguageEngagement / InternshipEngagement with a `type` discriminator
-- (same approach as projects); the CHECK keeps per-type columns coherent.
-- Ceremonies are 1:1 with engagements (auto-created by the
-- EngagementCreatedHook handler, replacing Gel's triggers). Status history
-- drives the rules engine's "BackTo" dynamic transitions (mirror of Neo4j's
-- inactive status Property chain). pnp_id / growth_plan_id are deferred FKs
-- → files(id) (Phase 7).

CREATE TYPE "engagement_type" AS ENUM ('Language', 'Internship');

CREATE TYPE "engagement_status" AS ENUM (
  'InDevelopment',
  'DidNotDevelop',
  'Rejected',
  'Active',
  'ActiveChangedPlan',
  'DiscussingTermination',
  'DiscussingReactivation',
  'DiscussingChangeToPlan',
  'DiscussingSuspension',
  'Suspended',
  'FinalizingCompletion',
  'Terminated',
  'Completed',
  'Converted',
  'Unapproved',
  'Transferred',
  'NotRenewed'
);

CREATE TYPE "language_milestone" AS ENUM (
  'Unknown', 'None', 'OldTestament', 'NewTestament', 'FullBible'
);

CREATE TYPE "ai_assisted_translation" AS ENUM (
  'Unknown', 'None', 'Draft', 'Check', 'DraftAndCheck', 'Other'
);

CREATE TYPE "ceremony_type" AS ENUM ('Dedication', 'Certification');

CREATE TABLE "engagements" (
  "id"                            text PRIMARY KEY,
  "project_id"                    text NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "type"                          "engagement_type" NOT NULL,
  "status"                        "engagement_status" NOT NULL DEFAULT 'InDevelopment',
  "status_modified_at"            timestamptz,
  "last_suspended_at"             timestamptz,
  "last_reactivated_at"           timestamptz,
  "complete_date"                 date,
  "disbursement_complete_date"    date,
  "start_date_override"           date,
  "end_date_override"             date,
  "initial_end_date"              date,
  "description"                   jsonb,

  "language_id"                   text REFERENCES "languages"("id"),
  "first_scripture"               boolean,
  "luke_partnership"              boolean,
  "open_to_investor_visit"        boolean,
  "paratext_registry_id"          text,
  "rev79_community_id"            text,
  "pnp_id"                        text,
  "sent_printing_date"            date,
  "historic_goal"                 text,
  "milestone_planned"             "language_milestone" NOT NULL DEFAULT 'Unknown',
  "milestone_reached"             boolean,
  "using_ai_assisted_translation" "ai_assisted_translation" NOT NULL DEFAULT 'Unknown',

  "intern_id"                     text REFERENCES "users"("id"),
  "mentor_id"                     text REFERENCES "users"("id"),
  "position"                      text,
  "methodologies"                 text[] NOT NULL DEFAULT '{}',
  "country_of_origin_id"          text REFERENCES "locations"("id"),
  "growth_plan_id"                text,
  "marketable"                    boolean NOT NULL DEFAULT false,
  "web_id"                        text,

  "created_at"                    timestamptz NOT NULL DEFAULT now(),
  "modified_at"                   timestamptz NOT NULL DEFAULT now(),
  "updated_at"                    timestamptz NOT NULL DEFAULT now(),
  "deleted_at"                    timestamptz,

  CONSTRAINT "engagements_type_shape_chk" CHECK (
    ("type" = 'Language' AND "language_id" IS NOT NULL AND "intern_id" IS NULL)
    OR ("type" = 'Internship' AND "intern_id" IS NOT NULL AND "language_id" IS NULL)
  )
);

CREATE UNIQUE INDEX "engagements_project_language_active_unique"
  ON "engagements" ("project_id", "language_id")
  WHERE "language_id" IS NOT NULL AND "deleted_at" IS NULL;
CREATE UNIQUE INDEX "engagements_project_intern_active_unique"
  ON "engagements" ("project_id", "intern_id")
  WHERE "intern_id" IS NOT NULL AND "deleted_at" IS NULL;
CREATE INDEX "engagements_project_id_idx" ON "engagements" ("project_id");
CREATE INDEX "engagements_language_id_idx" ON "engagements" ("language_id");
CREATE INDEX "engagements_intern_id_idx" ON "engagements" ("intern_id");

CREATE TABLE "engagement_status_history" (
  "id"            bigserial PRIMARY KEY,
  "engagement_id" text NOT NULL REFERENCES "engagements"("id") ON DELETE CASCADE,
  "status"        "engagement_status" NOT NULL,
  "at"            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "engagement_status_history_engagement_id_at_idx"
  ON "engagement_status_history" ("engagement_id", "at");

CREATE TABLE "ceremonies" (
  "id"             text PRIMARY KEY,
  "engagement_id"  text NOT NULL REFERENCES "engagements"("id") ON DELETE CASCADE,
  "type"           "ceremony_type" NOT NULL,
  "planned"        boolean NOT NULL DEFAULT false,
  "estimated_date" date,
  "actual_date"    date,
  "created_at"     timestamptz NOT NULL DEFAULT now(),
  "updated_at"     timestamptz NOT NULL DEFAULT now(),
  "deleted_at"     timestamptz
);

CREATE UNIQUE INDEX "ceremonies_engagement_active_unique"
  ON "ceremonies" ("engagement_id")
  WHERE "deleted_at" IS NULL;

-- Full FK indexes the invariant suite requires beyond mono's originals:
-- mentor_id / country_of_origin_id had no coverage at all, and ceremonies'
-- partial unique on engagement_id can't serve FK-maintenance scans.
CREATE INDEX "engagements_mentor_id_idx" ON "engagements" ("mentor_id");
CREATE INDEX "engagements_country_of_origin_id_idx" ON "engagements" ("country_of_origin_id");
CREATE INDEX "ceremonies_engagement_id_idx" ON "ceremonies" ("engagement_id");
