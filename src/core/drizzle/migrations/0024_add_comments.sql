-- Comments (Phase 6). Comment threads attach to any Commentable resource via
-- a polymorphic, FK-less parent_id + parent_type discriminator (parents span
-- tables: User/Language/Partner/Project/Engagement/ProgressReport). Comments
-- hang off a thread and are hard-deleted (cascade), matching
-- CommentService.delete.
--
-- Also installs the deferred FK from notifications.comment_id (added FK-less in
-- migration 0012) now that the comments table exists.

CREATE TABLE "comment_threads" (
  "id"          text PRIMARY KEY,
  "parent_id"   text NOT NULL,
  "parent_type" text NOT NULL,
  "creator_id"  text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at"  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "comment_threads_parent_id_idx" ON "comment_threads" ("parent_id");
CREATE INDEX "comment_threads_creator_id_idx" ON "comment_threads" ("creator_id");

CREATE TABLE "comments" (
  "id"          text PRIMARY KEY,
  "thread_id"   text NOT NULL REFERENCES "comment_threads"("id") ON DELETE CASCADE,
  "creator_id"  text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "body"        jsonb NOT NULL,
  "created_at"  timestamptz NOT NULL DEFAULT now(),
  "modified_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "comments_thread_id_idx" ON "comments" ("thread_id");
CREATE INDEX "comments_creator_id_idx" ON "comments" ("creator_id");

ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_comment_id_fk"
  FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE CASCADE;
