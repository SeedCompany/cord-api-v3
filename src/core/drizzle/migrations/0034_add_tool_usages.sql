-- Tool Usages (Phase 7). Records that a container resource uses a Tool, with
-- the date usage started.
--
-- Neo4j models this as a ToolUsage node with three relationships:
--   container -[:uses]-> usage -[:tool]-> Tool,  usage -[:creator]-> Actor
-- Here the node becomes a row and the relationships become columns.
--
-- container_id is polymorphic and therefore FK-less (same rationale as
-- comment_threads.parent_id / prompt_variant_responses.parent_id). The target
-- is ANY resource, not just Project/Engagement: `CreateToolUsage.container` is
-- an `ID<'Resource'>`, the Cypher matches any `BaseNode`, and `Resource.tools`
-- is a field on the Resource interface. Only Project and Engagement containers
-- are written today, but the domain was built open and is expected to stay that
-- way (Rob, 2026-07-29).
--
-- FK-less is therefore DELIBERATE, and both alternatives were considered and
-- rejected on 2026-07-29 — do not re-propose without reading this:
--   * Exclusive arc (one nullable FK column + CHECK arm per target table) is
--     the right shape for 2-3 known targets, and untenable for "any resource".
--   * A `resources(id, type)` supertype table that every resource FKs into
--     would give real referential integrity, but reintroduces a table of all
--     nodes — i.e. it walks back toward the graph database this migration is
--     leaving (Rob's call). Accepted cost: no referential integrity on this
--     column. Dangling container_ids are caught by the cutover ETL, which
--     already tracks dangling refs as a known data class.
--
-- container_type is the discriminator, storing the CONCRETE __typename (e.g.
-- 'LanguageEngagement', 'MomentumTranslationProject'). Reads key off it to
-- query only the tables actually referenced, and — because the target set is
-- open — to tell a DELETED container apart from one whose type the Drizzle
-- resource-table registry does not yet cover. The latter is a registry gap that
-- gets logged, not silently dropped.
--
-- Note the GraphQL `ToolContainerType` enum is the NORMALIZED bucket
-- ('Engagement' | 'Project'), not this column. The bucket is derived from
-- container_type at query time, matching the Cypher's label-normalizing CASE.
-- Kept as text rather than a pgEnum precisely because it holds concrete
-- typenames, which grow whenever a new Project/Engagement subtype is added —
-- same choice as comment_threads.parent_type.
--
-- creator_id references users like every other ported creator column, even
-- though the DTO types it as Actor (User | SystemAgent); no ported table
-- currently stores a SystemAgent creator.
--
-- Soft-deleted (the service calls repo.deleteNode), so the one-live-usage-per
-- (container, tool) invariant is a PARTIAL unique index. The service checks
-- usageFor() before create and raises DuplicateException; the invariant belongs
-- here too.

CREATE TABLE "tool_usages" (
  "id"              text PRIMARY KEY,
  "container_id"    text NOT NULL,
  "container_type"  text NOT NULL,
  "tool_id"         text NOT NULL REFERENCES "tools"("id"),
  "creator_id"      text NOT NULL REFERENCES "users"("id"),
  "start_date"      date,
  "created_at"      timestamptz NOT NULL DEFAULT now(),
  "updated_at"      timestamptz NOT NULL DEFAULT now(),
  "deleted_at"      timestamptz
);

CREATE UNIQUE INDEX "tool_usages_container_tool_unique"
  ON "tool_usages" ("container_id", "tool_id")
  WHERE "deleted_at" IS NULL;

CREATE INDEX "tool_usages_container_id_idx" ON "tool_usages" ("container_id");
CREATE INDEX "tool_usages_tool_id_idx"      ON "tool_usages" ("tool_id");
CREATE INDEX "tool_usages_creator_id_idx"   ON "tool_usages" ("creator_id");
