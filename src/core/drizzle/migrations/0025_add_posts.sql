-- Posts (Phase 6). Posts attach to any Postable resource (Language/Partner/
-- Project) via a polymorphic, FK-less parent_id + parent_type discriminator.
-- Membership-shareability visibility is enforced in the repo against
-- project_members. shareability keeps the deprecated 'ProjectTeam' value for
-- parity with Neo4j (stored verbatim).

CREATE TYPE "post_type" AS ENUM ('Note', 'Story', 'Prayer');

CREATE TYPE "post_shareability" AS ENUM (
  'Membership', 'ProjectTeam', 'Internal', 'AskToShareExternally', 'External'
);

CREATE TABLE "posts" (
  "id"           text PRIMARY KEY,
  "parent_id"    text NOT NULL,
  "parent_type"  text NOT NULL,
  "creator_id"   text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "type"         "post_type" NOT NULL,
  "shareability" "post_shareability" NOT NULL,
  "body"         text NOT NULL,
  "created_at"   timestamptz NOT NULL DEFAULT now(),
  "modified_at"  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "posts_parent_id_idx" ON "posts" ("parent_id");
CREATE INDEX "posts_creator_id_idx" ON "posts" ("creator_id");
