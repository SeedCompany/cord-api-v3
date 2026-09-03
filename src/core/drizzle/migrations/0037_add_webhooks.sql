-- Webhooks (Phase 7). Prod has zero rows in any of the three Neo4j node types
-- this replaces (Webhook, WebhookExecutor, BroadcastChannel), so this is a
-- greenfield port: no ETL, no backfill.
--
-- webhook_executors holds the signing secret, one row per user, created
-- lazily on first save. It is NOT on webhooks: Neo4j models the secret this
-- way too, so rotating rotates for every webhook a user owns at once.
--
-- webhooks.key is user-provided (defaults to the GraphQL operation name) and
-- is only unique per-owner. Neo4j gets this for free by always traversing
-- from the current user; here it's an explicit composite unique index.
-- No soft delete — Neo4j's deleteBy hard-deletes (detachDelete), so this
-- matches.
--
-- broadcast_channels is a named event bucket a webhook can observe (e.g.
-- "project:created"), shared globally with no properties besides its name,
-- matching the Neo4j BroadcastChannel node's unique-constrained-by-name
-- shape. webhook_channel_observations is the join, carrying evaluated_at so
-- a SubscriptionChannelVersion bump can find webhooks needing re-evaluation.
-- channel_name has no ON DELETE CASCADE: a broadcast_channels row is only
-- ever removed once nothing observes it (checked explicitly in application
-- code), so the FK is a correctness backstop, not a path expected to fire.

CREATE TABLE "webhook_executors" (
  "user_id"    text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "secret"     text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "webhook_executors_pkey" PRIMARY KEY ("user_id")
);

CREATE TABLE "webhooks" (
  "id"           text NOT NULL,
  "owner_id"     text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "key"          text NOT NULL,
  "name"         text NOT NULL,
  "subscription" text NOT NULL,
  "variables"    jsonb,
  "url"          text NOT NULL,
  "metadata"     jsonb,
  "valid"        boolean NOT NULL DEFAULT true,
  "created_at"   timestamptz NOT NULL DEFAULT now(),
  "modified_at"  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "webhooks_pkey" PRIMARY KEY ("id")
);

-- Leading column also covers owner_id for FK-maintenance scans, so no
-- separate index on owner_id is needed.
CREATE UNIQUE INDEX "webhooks_owner_key_unique" ON "webhooks" ("owner_id", "key");

CREATE TABLE "broadcast_channels" (
  "name"       text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "broadcast_channels_pkey" PRIMARY KEY ("name")
);

CREATE TABLE "webhook_channel_observations" (
  "webhook_id"    text NOT NULL REFERENCES "webhooks"("id") ON DELETE CASCADE,
  "channel_name"  text NOT NULL REFERENCES "broadcast_channels"("name"),
  "evaluated_at"  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "webhook_channel_observations_pkey" PRIMARY KEY ("webhook_id", "channel_name")
);

-- Leading column also covers webhook_id for FK-maintenance scans.
CREATE INDEX "webhook_channel_observations_channel_name_idx"
  ON "webhook_channel_observations" ("channel_name");
