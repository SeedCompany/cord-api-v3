-- Initial Fiscal Year Allocation (cord-field#1902): the fiscal year a
-- project's initial fiscal year allocation was applied in.
--
-- An integer fiscal year, the same shape as `budget_records.fiscal_year` and
-- the `fiscalYear()` helpers (FY N runs Oct 1 of N-1 through Sep 30 of N). Not
-- a date: the value names a fiscal year, not a day, and a date would force an
-- arbitrary day onto it.
--
-- Nullable with no default: existing projects have no recorded value, and
-- inventing one would make "not recorded yet" uncountable.
--
-- Two backstops, each enforced first by the API with a clearer message:
-- - Multiplication projects do not track this, so a value on one is refused.
-- - A value must be a four-digit year (1000-9999). An integer carries no
--   leading zeros, so that range is exactly "four digits"; it catches typos
--   like 27 for 2027.

ALTER TABLE "projects"
  ADD COLUMN "initial_fiscal_year_allocation" integer,
  ADD CONSTRAINT "projects_initial_fiscal_year_allocation_not_multiplication_chk"
  CHECK ("initial_fiscal_year_allocation" IS NULL OR "type" <> 'MultiplicationTranslation'),
  ADD CONSTRAINT "projects_initial_fiscal_year_allocation_four_digits_chk"
  CHECK ("initial_fiscal_year_allocation" IS NULL OR "initial_fiscal_year_allocation" BETWEEN 1000 AND 9999);
