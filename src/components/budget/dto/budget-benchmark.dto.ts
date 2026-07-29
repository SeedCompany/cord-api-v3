import { Field, Float, InputType, ObjectType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { GraphQLJSONObject } from 'graphql-scalars';
import { type ID, IdField, OptionalField } from '~/common';

/**
 * Input for the `budgetBenchmark` query (budget-line-items-poc phase 3) — the
 * server-side equivalent of the prototype's benchmark-calculator modal
 * (`resolveCalcParams()` / `previewKeystone()` / `applyModal()` in
 * `src/app.js`). See `BudgetResolver.budgetBenchmark` for the full math.
 */
@InputType()
export abstract class BudgetBenchmarkInput {
  @IdField({
    description: 'The budget whose (derived) country this benchmark uses.',
  })
  readonly budget: ID<'Budget'>;

  @Field({
    description: stripIndent`
      The chart-of-accounts line this figure is for — same free-text values
      as \`BudgetLineItem.account\`. Only accounts in \`KEYSTONE_ACCTS\` (see
      \`budget-calculation.service.ts\`) have a benchmark; anything else
      resolves to a null result.
    `,
  })
  readonly account: string;

  @OptionalField(() => String, {
    description: stripIndent`
      Only meaningful when \`account\` is "Salary/Stipend - Consultant" — one
      of the 3 consultant sub-role labels ("Sr. Translation Consultant" /
      "Independent Translation Consultant" / "Dependent Consultant (CiT)").
      Defaults to "Sr. Translation Consultant" if omitted, matching the
      prototype's modal default.
    `,
  })
  readonly consultantType?: string;

  @OptionalField(() => [Float], {
    description: stripIndent`
      Only meaningful for the 3 SALARY_ACCTS — weeks of work in each fiscal
      year of the budget's project, ordered to match the project's fiscal
      years (oldest first). Padded/truncated to the project's actual fiscal
      -year count if the length doesn't match.
    `,
  })
  readonly weeksPerFiscalYear?: readonly number[];

  @OptionalField(() => Float, {
    description: stripIndent`
      Skips the entire country/role/keystone-rate lookup and spreads this
      flat annual figure across the budget's fiscal years directly (via
      \`BudgetCalculationService.spreadAnnual\`) — the equivalent of the
      prototype modal's "Spread an annual amount" mode. Works for ANY
      \`account\`, not just \`KEYSTONE_ACCTS\`. When set, \`consultantType\`,
      \`weeksPerFiscalYear\`, and \`countryId\` are all ignored, and the
      result's \`weeklyOrAnnualFigure\` just echoes this value back.
    `,
  })
  readonly annualAmount?: number;

  @IdField({
    optional: true,
    description: stripIndent`
      Overrides the budget's derived country (see \`Budget.country\`) for
      this calculation only — doesn't change the budget itself. One of
      \`budgetReferenceCountries\`' ids. Only meaningful for the keystone
      salary/service path (ignored entirely when \`annualAmount\` is set);
      use this when the project has no resolvable country (or a
      different one is wanted for this benchmark) — matching the
      prototype modal's "Country for this calculation" override select.
    `,
  })
  readonly countryId?: ID<'BudgetReferenceCountry'>;
}

/**
 * Result of the `budgetBenchmark` query. Deliberately carries only the
 * COMPUTED figures — never the underlying reference country/rate row (see
 * `BudgetReferenceKeystoneRateRepository`'s doc comment: reference benchmark
 * data is for calculation only and is never displayed/exposed directly,
 * matching the prototype's own "Privacy" design goal).
 *
 * Sensitivity masking (the prototype's High-sensitivity "rate hidden"
 * behavior) is NOT applied here — that only ever masked the prototype's
 * auto-generated line description text, never the figure itself for someone
 * who already has edit access to the budget. The frontend decides what to
 * display based on \`budget.sensitivity\`.
 */
@ObjectType()
export class BudgetBenchmarkResult {
  @Field(() => Float, {
    description: stripIndent`
      For the 3 SALARY_ACCTS: the weekly benchmark rate, in the budget's
      entry currency. For the 4 SERVICE_ACCTS: the annual figure
      (weekly-rate-shaped benchmark × the budget's (computed) languageCount)
      before fiscal-year spreading.
    `,
  })
  readonly weeklyOrAnnualFigure: number;

  @Field(() => GraphQLJSONObject, {
    description:
      "The figure spread across the budget's fiscal years, keyed by fiscal year number as a string — same shape as `BudgetLineItem.fiscalYearAmounts`.",
  })
  readonly fiscalYearAmounts: Record<string, number>;
}
