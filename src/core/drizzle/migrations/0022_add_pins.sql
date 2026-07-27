-- Pins (Phase 6). Per-user pins over any resource; resource_id is FK-less
-- because a user can pin any Pinnable (Project, Language, Partner, User, …)
-- which span tables — same rationale as prompt_variant_responses.parent_id.
-- The composite PK makes pin/unpin idempotent and the per-requester `pinned`
-- field lookup a PK hit. user_id (the PK's leading column) needs no separate
-- FK index; resource_id is FK-less.

CREATE TABLE "pins" (
  "user_id"     text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "resource_id" text NOT NULL,
  "created_at"  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "pins_pkey" PRIMARY KEY ("user_id", "resource_id")
);
