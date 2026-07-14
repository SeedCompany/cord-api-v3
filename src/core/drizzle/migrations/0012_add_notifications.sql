-- Notifications (Phase 6). Single-table inheritance over notification
-- subtypes: the `type` discriminator maps to the registered strategy, and
-- each subtype's extra fields live in nullable columns guarded by the shape
-- CHECK. Per-recipient read state lives in `notification_recipients` so
-- `unread` is computed per requesting user, not stored on the notification.

CREATE TYPE "notification_type" AS ENUM ('System', 'CommentViaMention');

CREATE TABLE "notifications" (
  "id"         text PRIMARY KEY,
  "type"       "notification_type" NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "creator_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  -- System
  "message"    text,
  -- CommentViaMention. FK-less for now — the comments table lands in a later
  -- Phase 6 migration; the FK is added then.
  "comment_id" text,
  CONSTRAINT "notifications_shape" CHECK (
    ("type" = 'System' AND "message" IS NOT NULL AND "comment_id" IS NULL)
    OR ("type" = 'CommentViaMention' AND "comment_id" IS NOT NULL AND "message" IS NULL)
  )
);

CREATE INDEX "notifications_created_at_idx" ON "notifications" ("created_at");
-- FK + deferred-FK indexes (mono added these in 0028; included up front here
-- per the index-every-FK standard).
CREATE INDEX "notifications_creator_id_idx" ON "notifications" ("creator_id");
CREATE INDEX "notifications_comment_id_idx" ON "notifications" ("comment_id");

CREATE TABLE "notification_recipients" (
  "notification_id" text NOT NULL REFERENCES "notifications"("id") ON DELETE CASCADE,
  "user_id"         text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "read_at"         timestamptz,
  CONSTRAINT "notification_recipients_pkey" PRIMARY KEY ("notification_id", "user_id")
);

CREATE INDEX "notification_recipients_user_id_idx" ON "notification_recipients" ("user_id");
