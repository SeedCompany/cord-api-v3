-- One featured community story per progress report — #3972.
--
-- `featured`: whether this prompt response is the one its report puts forward,
-- today the Progress Report's featured community story. It lives on the shared
-- prompt_variant_responses table because every prompt-response section stores
-- its rows there; only the community-story path writes it for now.
--
-- The partial unique index is the fail-safe behind the service's clear-then-set:
-- demoting the current story and promoting the new one happen in one
-- transaction and never collide, while two people featuring different stories
-- at the same moment leave one of them with a unique violation instead of a
-- report with two featured stories. Scoped by resource_type so a featured Team
-- News entry (if that ever exists) does not block a featured story on the same
-- report, and by deleted_at so a soft-deleted story frees the slot.
ALTER TABLE "prompt_variant_responses" ADD COLUMN "featured" boolean NOT NULL DEFAULT false;--> statement-breakpoint
CREATE UNIQUE INDEX "prompt_variant_responses_one_featured" ON "prompt_variant_responses" ("parent_id","resource_type") WHERE "featured" AND "deleted_at" IS NULL;
