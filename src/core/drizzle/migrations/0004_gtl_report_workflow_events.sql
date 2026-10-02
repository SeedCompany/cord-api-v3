-- GTL report workflow events — #3967.
--
-- The append-only status-transition history for a GTL quarterly report, the
-- counterpart of `progress_report_workflow_events` keyed to the GTL status
-- enum from 0003. The report's current status stays on
-- `periodic_reports.gtl_status`, written app-side when an event is recorded;
-- no trigger syncs it (same split as the Progress sibling).
--
-- Actor shape is 0001's: exactly one of `who` (a User) or
-- `who_system_agent_id` (a SystemAgent) is set, enforced by the CHECK, so an
-- automated process can be recorded as the actor without a fake user row.
--
-- Every foreign-key column gets its own index (the FK-index invariant in
-- test/postgres-schema.e2e-spec.ts). `(report_id, at)` doubles as the FK index
-- for report_id and serves the oldest-first list read.

CREATE TABLE "gtl_report_workflow_events" (
  "id" text PRIMARY KEY,
  "report_id" text NOT NULL REFERENCES "periodic_reports"("id") ON DELETE CASCADE,
  "who" text REFERENCES "users"("id"),
  "who_system_agent_id" text REFERENCES "system_agents"("id"),
  "status" "gtl_report_status" NOT NULL,
  "transition_key" text,
  "notes" jsonb,
  "at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "gtl_report_workflow_events_actor_shape_chk"
    CHECK (num_nonnulls("who", "who_system_agent_id") = 1)
);--> statement-breakpoint

CREATE INDEX "gtl_report_workflow_events_report_id_at_idx"
  ON "gtl_report_workflow_events" ("report_id", "at");--> statement-breakpoint

CREATE INDEX "gtl_report_workflow_events_who_idx"
  ON "gtl_report_workflow_events" ("who");--> statement-breakpoint

CREATE INDEX "gtl_report_workflow_events_who_system_agent_id_idx"
  ON "gtl_report_workflow_events" ("who_system_agent_id");
