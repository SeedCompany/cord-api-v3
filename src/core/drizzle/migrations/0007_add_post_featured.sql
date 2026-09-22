-- Migration: let a post be marked as one of the items curated into this
-- quarter's Investor Report, distinct from being merely cleared to leave
-- Seed Company at all.
--
-- `shareability`/`approved_shareability` answer "how widely may this reach" --
-- a permission. This answers a different question: "is this specific request,
-- in this specific report, one of the ones we're actually publishing" -- a
-- curation choice, made by whoever assembles investor communications, and
-- only meaningful once a request is attached to a report at all (see
-- report_id from migration 0005).
--
-- Not exclusive like prompt_variant_responses.featured (migration 0008): a
-- report can carry several prayer requests, and there's no single "the"
-- investor-facing prayer item the way there's one investor-facing story.
-- Every matching request can be featured independently.
ALTER TABLE "posts"
  ADD COLUMN "featured" boolean NOT NULL DEFAULT false;
