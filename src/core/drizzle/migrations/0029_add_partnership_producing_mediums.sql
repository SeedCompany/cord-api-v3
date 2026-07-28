-- Partnership Producing Mediums (Phase 7). Which Partnership is responsible for
-- producing each ProductMedium on a LanguageEngagement.
--
-- In Neo4j this is a `PartnershipProducingMedium` RELATIONSHIP from the
-- engagement to the partnership, carrying `medium` as a relationship property
-- and using active/deletedAt to reassign. Here it collapses to a plain
-- association row.
--
-- Hard delete, not soft: this is a pure assignment (one partnership per
-- medium), reads only ever want the live row, and the Neo4j deactivation was an
-- artifact of relationship-property history rather than a retention
-- requirement. Mutation history is covered by resource_mutations (0026).
--
-- The composite PK enforces "a medium can only be mentioned once per
-- engagement" in the DB — the service raises InputException for the same rule,
-- but the invariant belongs here.
--
-- Note there is no `medium` catalogue table: the set of *available* mediums for
-- an engagement is derived at read time from its products' `mediums` array, so
-- a row here only ever exists for a medium some product declares.

CREATE TABLE "partnership_producing_mediums" (
  "engagement_id"   text NOT NULL REFERENCES "engagements"("id") ON DELETE CASCADE,
  "medium"          "product_medium" NOT NULL,
  "partnership_id"  text NOT NULL REFERENCES "partnerships"("id") ON DELETE CASCADE,
  "created_at"      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("engagement_id", "medium")
);

CREATE INDEX "partnership_producing_mediums_partnership_id_idx"
  ON "partnership_producing_mediums" ("partnership_id");
