-- Audit Log. Append-only log of resource mutations: one row per
-- create/update/delete, written by an in-transaction hook so it's atomic with
-- the mutation. resource_id is FK-less/polymorphic (spans every resource
-- table); actor_id is set null on user delete so history outlives the actor.
-- role_at_time snapshots the actor's global roles at write time as plain text
-- (NOT the live role enum) so the append-only record is immune to later role
-- changes.

CREATE TYPE "mutation_action" AS ENUM ('Create', 'Update', 'Delete');

CREATE TABLE "resource_mutations" (
  "id"            bigserial PRIMARY KEY,
  "resource_type" text NOT NULL,
  "resource_id"   text NOT NULL,
  "action"        "mutation_action" NOT NULL,
  "actor_id"      text REFERENCES "users"("id") ON DELETE SET NULL,
  "role_at_time"  text[] NOT NULL DEFAULT '{}',
  "changes"       jsonb,
  "at"            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "resource_mutations_resource_idx"
  ON "resource_mutations" ("resource_type", "resource_id", "at");
CREATE INDEX "resource_mutations_actor_id_idx"
  ON "resource_mutations" ("actor_id");
