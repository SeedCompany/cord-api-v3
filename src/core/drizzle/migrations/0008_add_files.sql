-- Files (Phase 7). Single-table inheritance over the file tree
-- (Directory/File/FileVersion) with a `type` discriminator + shape CHECK.
-- parent_id self-FK forms the tree. Binary bytes live in S3 (key = FileVersion
-- id) and are untouched. mime_type/size live on FileVersion rows; a File
-- surfaces its latest version via latest_version_id (denormalized); Directory
-- aggregates are computed at read time. Soft-deleted.

CREATE TYPE "file_node_type" AS ENUM ('Directory', 'File', 'FileVersion');
CREATE TYPE "media_type" AS ENUM ('Image', 'Video', 'Audio');

CREATE TABLE "file_nodes" (
  "id"                text PRIMARY KEY,
  "type"              "file_node_type" NOT NULL,
  "name"              text NOT NULL,
  "public"            boolean,
  "parent_id"         text REFERENCES "file_nodes"("id"),
  "created_by_id"     text NOT NULL REFERENCES "users"("id"),
  "mime_type"         text,
  "size"              bigint,
  "latest_version_id" text REFERENCES "file_nodes"("id"),
  "created_at"        timestamptz NOT NULL DEFAULT now(),
  "deleted_at"        timestamptz,
  CONSTRAINT "file_nodes_shape" CHECK (
    ("type" = 'Directory' AND "mime_type" IS NULL AND "size" IS NULL AND "latest_version_id" IS NULL)
    OR ("type" = 'File' AND "mime_type" IS NULL AND "size" IS NULL)
    OR ("type" = 'FileVersion' AND "mime_type" IS NOT NULL AND "size" IS NOT NULL AND "latest_version_id" IS NULL)
  )
);

CREATE INDEX "file_nodes_parent_id_idx" ON "file_nodes" ("parent_id");
CREATE INDEX "file_nodes_created_by_id_idx" ON "file_nodes" ("created_by_id");
CREATE INDEX "file_nodes_latest_version_id_idx" ON "file_nodes" ("latest_version_id");

CREATE TABLE "media" (
  "id"              text PRIMARY KEY,
  "type"            "media_type" NOT NULL,
  "file_version_id" text NOT NULL REFERENCES "file_nodes"("id") ON DELETE CASCADE,
  "mime_type"       text NOT NULL,
  "alt_text"        text,
  "caption"         text,
  "width"           integer,
  "height"          integer,
  "duration"        double precision,
  "created_at"      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "media_file_version_id_unique" ON "media" ("file_version_id");
