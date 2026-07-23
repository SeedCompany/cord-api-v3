-- Budget line-items POC (budget-line-items-poc branch). Adds the field-budget
-- calculator's line-item grid (budget_line_items), other-partner-contribution
-- tracking (other_partner_contributions), and the country/keystone reference
-- data the calculation engine benchmarks against (budget_reference_countries,
-- budget_reference_keystone_rates), plus the new currency/inflation/admin-fee
-- config columns on budgets itself.
--
--   - budget_reference_countries / budget_reference_keystone_rates are pure
--     seeded lookup data: no deleted_at. Countries still get a generateId()
--     text id (not bigserial) so a future admin-edit mutation can address a
--     row without a schema change; keystone rates are pure append-only rows
--     never addressed by a public ID, so bigserial per convention.
--   - entry_currency_mode / display_currency_mode / cost_type /
--     budget_category / activity are plain text, not pg enums — matches the
--     existing `variant` convention for small fixed-value-set fields
--     (prompt_variant_response_entries.variant, product_progress.variant).
--   - fiscal_year_amounts is a JSON object keyed by fiscal year number as a
--     string, e.g. { "2025": 3000000, "2026": 4000000 }.
--   - budget_line_items.account is freeform text — no dedicated
--     chart-of-accounts table exists yet for BudgetRecord/FundingAccount to
--     key off of.

CREATE TABLE "budget_line_items" (
	"id" text PRIMARY KEY NOT NULL,
	"budget_id" text NOT NULL,
	"account" text NOT NULL,
	"description" text,
	"cost_type" text DEFAULT 'Cash' NOT NULL,
	"budget_category" text DEFAULT 'Field Budget' NOT NULL,
	"activity" text,
	"service_provider_org_id" text,
	"funder_org_id" text,
	"fiscal_year_amounts" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "budget_reference_countries" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"region" text,
	"keystone_country_name" text,
	"currency_code" text,
	"cost_of_living_index" double precision,
	"index_methodology" text,
	"admin_fee_cap" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budget_reference_keystone_rates" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"keystone_country_name" text NOT NULL,
	"role" text NOT NULL,
	"weekly_rate_usd" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "other_partner_contributions" (
	"id" text PRIMARY KEY NOT NULL,
	"budget_id" text NOT NULL,
	"donor_org_id" text,
	"description" text,
	"fiscal_year_amounts" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "budgets" ADD COLUMN "country_id" text;--> statement-breakpoint
ALTER TABLE "budgets" ADD COLUMN "entry_currency_mode" text DEFAULT 'USD' NOT NULL;--> statement-breakpoint
ALTER TABLE "budgets" ADD COLUMN "display_currency_mode" text DEFAULT 'USD' NOT NULL;--> statement-breakpoint
ALTER TABLE "budgets" ADD COLUMN "exchange_rate" double precision DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "budgets" ADD COLUMN "inflation_rate" double precision DEFAULT 0.03 NOT NULL;--> statement-breakpoint
ALTER TABLE "budgets" ADD COLUMN "admin_fee_percent" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "budgets" ADD COLUMN "language_count" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "budget_line_items" ADD CONSTRAINT "budget_line_items_budget_id_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."budgets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_line_items" ADD CONSTRAINT "budget_line_items_service_provider_org_id_organizations_id_fk" FOREIGN KEY ("service_provider_org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_line_items" ADD CONSTRAINT "budget_line_items_funder_org_id_organizations_id_fk" FOREIGN KEY ("funder_org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "other_partner_contributions" ADD CONSTRAINT "other_partner_contributions_budget_id_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."budgets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "other_partner_contributions" ADD CONSTRAINT "other_partner_contributions_donor_org_id_organizations_id_fk" FOREIGN KEY ("donor_org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "budget_line_items_budget_id_idx" ON "budget_line_items" USING btree ("budget_id");--> statement-breakpoint
CREATE INDEX "budget_line_items_service_provider_org_id_idx" ON "budget_line_items" USING btree ("service_provider_org_id");--> statement-breakpoint
CREATE INDEX "budget_line_items_funder_org_id_idx" ON "budget_line_items" USING btree ("funder_org_id");--> statement-breakpoint
CREATE INDEX "other_partner_contributions_budget_id_idx" ON "other_partner_contributions" USING btree ("budget_id");--> statement-breakpoint
CREATE INDEX "other_partner_contributions_donor_org_id_idx" ON "other_partner_contributions" USING btree ("donor_org_id");--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_country_id_budget_reference_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."budget_reference_countries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "budgets_country_id_idx" ON "budgets" USING btree ("country_id");