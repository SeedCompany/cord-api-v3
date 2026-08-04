-- Let a project workflow event be attributed to a SystemAgent, not just a User.
--
-- `project_workflow_events.who` was `NOT NULL REFERENCES users(id)`, which encodes
-- "every step transition was performed by a logged-in person". That is not true,
-- and not true by a wide margin: in real data the clear majority of events have a
-- SystemAgent actor. Under the old shape every one of them violates the FK, so
-- the load drops them — most of every project's step history, silently, because a
-- dropped row is not an error. Local development data hid this almost entirely,
-- which is why it surfaced only against a production-shaped copy.
--
-- Nothing above the repository needs to change FOR READS, because the read path
-- already models this correctly and only the Postgres column was behind:
--
--   * Neo4j matches `node('who', 'Actor')`, not `node('who', 'User')` — it has
--     always allowed either, which is how those rows came to exist.
--   * `ProjectWorkflowEventResolver.who` resolves through `ActorLoader` and
--     returns `SecuredActor`, so the GraphQL contract is already a User-or-
--     SystemAgent union. (The `Secured<LinkTo<'User'>>` on the shared
--     `WorkflowEvent` DTO is a stale TypeScript annotation, not the contract.)
--   * `system_agents` already exists and the loader already populates it.
--
-- On the WRITE side there is one known gap, pre-existing and not caused by this
-- migration: the step-change email handler looks the actor up as a person, so an
-- agent-authored transition that carries notification recipients throws — and
-- since hooks run inside the transition's transaction, the whole transition rolls
-- back. This migration changes only WHERE that fails: before, the insert was
-- rejected at the `who` foreign key; now the insert succeeds and the hook throws
-- instead. It strictly improves the no-recipients case, which now succeeds. Neo4j
-- fails the same flow for the same reason (its actor edge is matched with a `User`
-- label that agents do not carry), so this is parity rather than a regression, and
-- the fix is tracked as post-cutover work. Note the pre-existing agent-actored
-- events all came from the step-history backfill, which writes directly and never
-- fires a hook — reads of them are fine.
--
-- SHAPE: two nullable columns and a CHECK, matching `resource_mutations`'
-- actor arc from 0027 rather than inventing a second idiom for the same problem.
--
-- ONE DELIBERATE DIVERGENCE FROM 0027: this stores the agent's ID as a real FK,
-- where the audit log stores its NAME as text. Not an inconsistency — the two
-- tables want different things. An audit row is a historical SNAPSHOT (it
-- snapshots `role_at_time` for the same reason) and must survive the removal of
-- what it names, so a hard reference is wrong there. A workflow event is live
-- project history whose actor is READ BACK as a hydrated object: Neo4j models it
-- as an edge to a real Actor node, and `ActorLoader` needs an id. Storing a name
-- here would mean a name->id lookup on every read to reconstruct what the FK
-- gives directly, and the loader already carries the agent ids across.
--
-- The CHECK is `= 1`, not 0027's `<= 1`: a transition cannot happen without an
-- actor (`identity.current` throws where the audit writer tolerates no session),
-- Neo4j's `who` edge is always present, and real data confirms it — no event
-- lacks an actor, and none carries an actor that is neither a live user nor a
-- system agent.
--
-- No ON DELETE clause on the new FK, matching `who`'s existing plain reference:
-- agents are lazily upserted by name and effectively permanent, and an event
-- losing its actor should fail loudly rather than quietly rewrite history.

ALTER TABLE "project_workflow_events"
  ALTER COLUMN "who" DROP NOT NULL;

ALTER TABLE "project_workflow_events"
  ADD COLUMN "who_system_agent_id" text REFERENCES "system_agents"("id");

ALTER TABLE "project_workflow_events"
  ADD CONSTRAINT "project_workflow_events_actor_shape_chk"
  CHECK (num_nonnulls("who", "who_system_agent_id") = 1);

CREATE INDEX "project_workflow_events_who_system_agent_id_idx"
  ON "project_workflow_events" ("who_system_agent_id");
