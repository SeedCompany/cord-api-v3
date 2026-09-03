-- Migration: let a post's externally-shown wording diverge from what its
-- author submitted, without losing the author's own words.
--
-- Immediate use: prayer requests need a translation pass (partner writes in
-- their own language) and sometimes a light moderator touch-up before they're
-- fit for an English-speaking, external audience. Both are edits to "what
-- gets shown," never to the record of what was actually asked for -- the same
-- reasoning that kept `shareability` (requested) and `approved_shareability`
-- (cleared) as two columns rather than one.
--
-- Null means nothing has diverged yet -- `body` is still the whole story.
-- Read `effective_body` (`final_body ?? body` -- see effectiveBodyOf in
-- post.dto.ts) anywhere the shown-to-others wording is what matters.
--
-- Editable by the Translator role and the same moderator roster as
-- `approved_shareability` (see FinalizePostWordingPolicy) -- both are doing
-- the same kind of work: producing the version everyone outside the author
-- actually reads.
ALTER TABLE "posts"
  ADD COLUMN "final_body" text;
