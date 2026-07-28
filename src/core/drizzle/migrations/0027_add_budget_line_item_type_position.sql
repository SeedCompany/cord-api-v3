-- Budget line-items POC, phase 2 (budget-line-items-poc branch): ordering +
-- header rows on budget_line_items, plus the future ISO alpha-3 join key on
-- budget_reference_countries.
--
--   - `type` ('line' | 'header') distinguishes normal calculation-bearing
--     rows from the prototype's visual-divider/section-header rows
--     (description-only, zero calculation impact — see
--     BudgetCalculationService.computeBudget's early-exit for `type ===
--     'header'`). Plain text, not a pg enum, per the existing small-fixed-
--     value-set convention (cost_type, budget_category, etc).
--   - `position` is a stable, server-assigned ordering column
--     (current-max-plus-one per budget, assigned by the repository on
--     create — never accepted from the client, see
--     BudgetLineItemRepository.create). Added nullable first, backfilled to
--     match existing creation order via `row_number() OVER (PARTITION BY
--     budget_id ORDER BY created_at, id)`, then set NOT NULL — a NOT NULL
--     column can't be added directly to an already-populated table without
--     either a default or a prior backfill, and a stored default wouldn't
--     make sense for a column whose value must be unique-per-budget.
--   - `account` is relaxed to nullable: header rows have no account
--     (matching the prototype's `acct: ""` convention, stored as NULL here
--     rather than empty string, per BudgetLineItem DTO conventions
--     elsewhere).
--   - `budget_reference_countries.iso_alpha3` is the future join key to
--     derive a budget's country from `Project.primaryLocation` in a later
--     phase — this table's own `name` column does not reliably match ISO
--     country names (see
--     `core/drizzle/seeds/backfill-budget-reference-country-iso.run.ts` for
--     the one-time backfill that populates this column for all 177 existing
--     rows).

ALTER TABLE "budget_line_items" ALTER COLUMN "account" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "budget_line_items" ADD COLUMN "type" text DEFAULT 'line' NOT NULL;--> statement-breakpoint
ALTER TABLE "budget_line_items" ADD COLUMN "position" integer;--> statement-breakpoint
UPDATE "budget_line_items" li SET "position" = sub.rn
FROM (
	SELECT id, row_number() OVER (PARTITION BY budget_id ORDER BY created_at, id) AS rn
	FROM "budget_line_items"
) sub
WHERE li.id = sub.id;--> statement-breakpoint
ALTER TABLE "budget_line_items" ALTER COLUMN "position" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "budget_reference_countries" ADD COLUMN "iso_alpha3" text;
