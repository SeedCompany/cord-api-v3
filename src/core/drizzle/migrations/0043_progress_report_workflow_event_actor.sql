-- Let a progress report workflow event be attributed to a SystemAgent, not just
-- a User — the Rev79 auto-advance (#3767) records the "Rev79" agent as the
-- actor when report data arriving starts a report.
--
-- Same shape and reasoning as 0031 (`project_workflow_events`): two nullable
-- columns with a `= 1` CHECK, agent stored as a real FK because the actor is
-- read back as a hydrated object through `ActorLoader`. See 0031's header for
-- the full argument, including why this diverges from the audit log's
-- name-snapshot approach (0027).
--
-- Unlike 0031 there is no pre-existing agent-actored data to admit here — every
-- existing row is user-actored — so this is purely forward-looking.

ALTER TABLE "progress_report_workflow_events"
  ALTER COLUMN "who" DROP NOT NULL;

ALTER TABLE "progress_report_workflow_events"
  ADD COLUMN "who_system_agent_id" text REFERENCES "system_agents"("id");

ALTER TABLE "progress_report_workflow_events"
  ADD CONSTRAINT "progress_report_workflow_events_actor_shape_chk"
  CHECK (num_nonnulls("who", "who_system_agent_id") = 1);

CREATE INDEX "progress_report_workflow_events_who_system_agent_id_idx"
  ON "progress_report_workflow_events" ("who_system_agent_id");
