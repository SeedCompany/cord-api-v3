-- `milestone_planned` and `using_ai_assisted_translation` belong to language
-- engagements. Make the database say so.
--
-- Both were NOT NULL DEFAULT 'Unknown', which stamped a language-translation
-- answer onto every INTERNSHIP row — engagements where the concepts do not
-- apply and where the GraphQL API never exposes the fields, since they live on
-- LanguageEngagement. Measured in production 2026-09-24: all 1,370 internships
-- carry 'Unknown' in both columns.
--
-- Those values were never in the source. The load that created this database
-- recorded these two columns, and only these two, as `mode: invented` with
-- `fallback: 'Unknown'` and `filled: 1370` — exactly the internship count. The
-- old database held nothing for those rows; the DEFAULT clause manufactured an
-- answer during the load. The same record shows `engagements.marketable`, the
-- mirror-image internship-only column, as `mode: blank` — so leaving the
-- inapplicable side empty was already the established behavior, and these two
-- were the exception to it.
--
-- Language engagements are the opposite case and stay untouched: only 1,370
-- rows took the fallback, so the 5,801 language rows reading 'Unknown' for a
-- planned milestone are values somebody actually recorded.
--
-- The control is one line away in the same table. `milestone_reached` is the
-- same domain concept, is nullable with no default, and is correctly blank on
-- every internship. So are the other nine language-only columns
-- (`language_id`, `pnp_id`, `first_scripture`, `historic_goal`,
-- `luke_partnership`, `paratext_registry_id`, `rev79_community_id`,
-- `open_to_investor_visit`, `last_reactivated_at`). These two were the only
-- language concepts filled in on internship rows, and the DEFAULT clause is
-- the entire reason.
--
-- 'Unknown' is not a harmless placeholder here: it is a real answer meaning
-- "we do not know", and so is 'None' — 722 language engagements deliberately
-- record 'None' for a planned milestone and 362 for AI assistance. Reusing
-- either as filler makes those genuine answers uncountable.

ALTER TABLE "engagements"
  ALTER COLUMN "milestone_planned" DROP NOT NULL,
  ALTER COLUMN "milestone_planned" DROP DEFAULT,
  ALTER COLUMN "using_ai_assisted_translation" DROP NOT NULL,
  ALTER COLUMN "using_ai_assisted_translation" DROP DEFAULT;

-- Erase what the default invented. Internship rows can only have gotten these
-- values from the DEFAULT clause: no code path writes them for internships
-- (the internship insert never names the columns) and the API cannot read them
-- there.
UPDATE "engagements"
SET "milestone_planned" = NULL,
    "using_ai_assisted_translation" = NULL
WHERE "type" = 'Internship';

-- Now enforce the shape in both directions, so this cannot come back. Dropping
-- NOT NULL on its own would weaken the language side; stating the rule as an
-- equivalence keeps that guarantee and adds its mirror. A future DEFAULT
-- clause, or any write that fills these on an internship, is refused rather
-- than silently applied.
--
-- Same form as `periodic_reports_status_shape_chk`. Validated in place rather
-- than NOT NULL/VALIDATE: the table is ~8,000 rows, so the scan is momentary.
ALTER TABLE "engagements"
  ADD CONSTRAINT "engagements_language_fields_shape_chk"
  CHECK (
    ("type" = 'Language') = ("milestone_planned" IS NOT NULL)
    AND
    ("type" = 'Language') = ("using_ai_assisted_translation" IS NOT NULL)
  );
