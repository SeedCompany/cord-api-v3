-- Audit log: attribute impersonated and system-agent actors.
--
-- 0026 gave every row one actor column, an FK to `users`. Three distinct
-- attribution gaps came out of that, all in the same code path:
--
--   1. IMPERSONATION WAS SILENTLY MISATTRIBUTED. `Identity.currentMaybe`
--      returns the EFFECTIVE session, so when an admin impersonated a user,
--      `actor_id` held the IMPERSONATED user and `role_at_time` held THEIR
--      roles — the admin who actually performed the mutation was absent from
--      the record entirely. That is wrong data, not missing data, and it fails
--      silently: the log confidently attributes an admin's action to an
--      innocent user. `impersonator_id` now carries the real requester.
--
--   2. GHOST IMPERSONATION CRASHED THE MUTATION. `X-CORD-Impersonate-User:
--      ghost` puts the Ghost SystemAgent's id in `session.userId`
--      (SessionManager.resumeSession swaps the literal for the agent). That id
--      lives in `system_agents`, not `users`, so the insert violated
--      `resource_mutations_actor_id_fkey` — and because the audit write shares
--      the mutation's transaction, the whole mutation rolled back. Latent only
--      because the writer no-ops off postgres.
--
--   3. SYSTEM-AGENT ACTORS WERE UNRECORDED. Anonymous-session mutations
--      (registration, bootstrap) stored a NULL actor with no trace of which
--      agent acted, indistinguishable from "actor unknown".
--
-- `actor_system_agent` stores the agent's NAME as text, NOT an FK to
-- `system_agents.id`. Deliberate, and the same call `role_at_time` already
-- makes one column over: an audit row is a historical SNAPSHOT, not a set of
-- live references, so the record has to survive later changes to — or removal
-- of — the thing it names. Agents are also lazily upserted BY NAME ('Ghost',
-- 'Anonymous', 'External Mailing Group'), so the name is their natural key,
-- and the table already declines to hold a hard actor reference: `actor_id` is
-- ON DELETE SET NULL precisely so history outlives the actor.
--
-- `impersonator_id` IS a plain FK to `users`, with no arc, because an
-- impersonATOR is always a real logged-in user: impersonation only takes
-- effect when the requester's own session resolved to a user (the
-- `impersonatee && result.userId` guard in SessionManager.resumeSession), so
-- it can never be a SystemAgent. Only the impersonATEE can be one — which is
-- why the two-column shape is needed on actor and nowhere else.
--
-- The CHECK is `<= 1`, not `= 1`: a mutation legitimately has no actor at all
-- when it runs in a session context that holds no session. Existing rows all
-- satisfy it — `actor_system_agent` is NULL for every one of them.
--
-- Role-only impersonation (`X-CORD-Impersonate-Role` with no user) yields
-- impersonator_id = actor_id. That is NOT a bug and does not want "fixing": it
-- records "this user acted under roles other than their own", and role_at_time
-- holds the roles the policy engine actually evaluated.

ALTER TABLE "resource_mutations"
  ADD COLUMN "impersonator_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  ADD COLUMN "actor_system_agent" text;

ALTER TABLE "resource_mutations"
  ADD CONSTRAINT "resource_mutations_actor_shape_chk"
  CHECK (num_nonnulls("actor_id", "actor_system_agent") <= 1);

CREATE INDEX "resource_mutations_impersonator_id_idx"
  ON "resource_mutations" ("impersonator_id");
