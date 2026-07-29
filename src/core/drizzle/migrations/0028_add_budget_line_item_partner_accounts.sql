-- Budget line-items POC, phase 2 continued: partner chart-of-accounts
-- mapping columns on budget_line_items.
--
--   - `partner_account_name` / `partner_account_number` capture the field's
--     "Show Partner Account Columns" mapping from this line's Seed Company
--     `account` to SIL's own chart of accounts — a real user choice (picked
--     from cascading dropdowns or typed free-text in manual mode), not a
--     computed 1:1 lookup, so it has to be stored per line item rather than
--     derived. Both nullable text: most lines never set them, and (like
--     `account`/`description`) there's no fixed value set to constrain
--     against.

ALTER TABLE "budget_line_items" ADD COLUMN "partner_account_name" text;--> statement-breakpoint
ALTER TABLE "budget_line_items" ADD COLUMN "partner_account_number" text;
