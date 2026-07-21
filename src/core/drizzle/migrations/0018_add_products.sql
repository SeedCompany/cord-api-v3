-- Product family (Phase 5). Producibles (Film / Story / EthnoArt) share one
-- table — shape-identical, the discriminator stands in for the Neo4j label.
-- Products are single-table inheritance over DirectScriptureProduct /
-- DerivativeScriptureProduct / OtherProduct (same approach as projects and
-- engagements). Scripture references are jsonb lists of {start, end} verse-id
-- pairs (the same shape Neo4j stores on ScriptureRange nodes); a null
-- scripture_references_override on a Derivative product means "not
-- overriding" (use the producible's list), replacing Neo4j's isOverriding
-- flag. product_completion_descriptions is the describeCompletion suggestion
-- store (ILIKE replaces the Neo4j full-text index).

CREATE TYPE "producible_type" AS ENUM ('Film', 'Story', 'EthnoArt');

CREATE TYPE "product_type" AS ENUM ('DirectScripture', 'Derivative', 'Other');

CREATE TYPE "progress_measurement" AS ENUM ('Number', 'Percent', 'Boolean');

-- Product vocabulary enums — mirror the app enums in
-- src/components/product/dto (postgres-schema.e2e enforces parity) and Gel's
-- Product::Medium/Purpose/Step/Methodology scalars.

CREATE TYPE "product_medium" AS ENUM
  ('Print', 'Web', 'EBook', 'App', 'TrainedStoryTellers', 'Audio', 'Video', 'Other');

CREATE TYPE "product_purpose" AS ENUM
  ('EvangelismChurchPlanting', 'ChurchLife', 'ChurchMaturity', 'SocialIssues', 'Discipleship');

CREATE TYPE "product_step" AS ENUM (
  'ExegesisAndFirstDraft',
  'TeamCheck',
  'CommunityTesting',
  'BackTranslation',
  'ConsultantCheck',
  'InternalizationAndDrafting',
  'PeerRevision',
  'ConsistencyCheckAndFinalEdits',
  'Craft',
  'Test',
  'Check',
  'Record',
  'Develop',
  'Translate',
  'Completed'
);

CREATE TYPE "product_methodology" AS ENUM (
  'Paratext',
  'OtherWritten',
  'Render',
  'Audacity',
  'AdobeAudition',
  'OtherOralTranslation',
  'StoryTogether',
  'SeedCompanyMethod',
  'OneStory',
  'Craft2Tell',
  'OtherOralStories',
  'Film',
  'SignLanguage',
  'OtherVisual'
);

-- 0017 left engagements.methodologies as text[] with the note that the
-- canonical enum lands with the Product domain — this is that landing.
-- (Dev-only chain: only ever applied to fresh/disposable databases.)
ALTER TABLE "engagements"
  ALTER COLUMN "methodologies" DROP DEFAULT,
  ALTER COLUMN "methodologies" TYPE "product_methodology"[]
    USING "methodologies"::"product_methodology"[],
  ALTER COLUMN "methodologies" SET DEFAULT '{}';

CREATE TABLE "producibles" (
  "id"                   text PRIMARY KEY,
  "type"                 "producible_type" NOT NULL,
  "name"                 text NOT NULL,
  "scripture_references" jsonb NOT NULL DEFAULT '[]',
  "created_at"           timestamptz NOT NULL DEFAULT now(),
  "updated_at"           timestamptz NOT NULL DEFAULT now(),
  "deleted_at"           timestamptz
);

CREATE UNIQUE INDEX "producibles_type_name_active_unique"
  ON "producibles" ("type", "name")
  WHERE "deleted_at" IS NULL;

CREATE TABLE "products" (
  "id"                                text PRIMARY KEY,
  "engagement_id"                     text NOT NULL REFERENCES "engagements"("id") ON DELETE CASCADE,
  "type"                              "product_type" NOT NULL,
  "mediums"                           "product_medium"[] NOT NULL DEFAULT '{}',
  "purposes"                          "product_purpose"[] NOT NULL DEFAULT '{}',
  "methodology"                       "product_methodology",
  "steps"                             "product_step"[] NOT NULL DEFAULT '{}',
  "describe_completion"               text,
  "placeholder_description"           text,
  "progress_step_measurement"         "progress_measurement" NOT NULL DEFAULT 'Percent',
  "progress_target"                   double precision NOT NULL DEFAULT 100,

  "scripture_references"              jsonb NOT NULL DEFAULT '[]',
  "scripture_references_override"     jsonb,
  "unspecified_scripture_book"        text,
  "unspecified_scripture_total_verses" integer,
  "total_verses"                      integer NOT NULL DEFAULT 0,
  "total_verse_equivalents"           double precision NOT NULL DEFAULT 0,

  "produces_id"                       text REFERENCES "producibles"("id"),
  "composite"                         boolean,

  "title"                             text,
  "description"                       text,

  "pnp_index"                         integer,

  "created_at"                        timestamptz NOT NULL DEFAULT now(),
  "updated_at"                        timestamptz NOT NULL DEFAULT now(),
  "deleted_at"                        timestamptz,

  CONSTRAINT "products_type_shape_chk" CHECK (
    ("type" = 'DirectScripture' AND "produces_id" IS NULL AND "title" IS NULL)
    OR ("type" = 'Derivative' AND "produces_id" IS NOT NULL AND "title" IS NULL)
    OR ("type" = 'Other' AND "title" IS NOT NULL AND "produces_id" IS NULL)
  ),
  CONSTRAINT "products_unspecified_scripture_chk" CHECK (
    ("unspecified_scripture_book" IS NULL) = ("unspecified_scripture_total_verses" IS NULL)
  )
);

CREATE INDEX "products_engagement_id_idx" ON "products" ("engagement_id");
CREATE INDEX "products_produces_id_idx" ON "products" ("produces_id");

CREATE TABLE "product_completion_descriptions" (
  "id"           bigserial PRIMARY KEY,
  "value"        text NOT NULL,
  "methodology"  "product_methodology" NOT NULL,
  "last_used_at" timestamptz NOT NULL DEFAULT now(),
  "created_at"   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "product_completion_descriptions_value_methodology_unique"
  ON "product_completion_descriptions" ("value", "methodology");
