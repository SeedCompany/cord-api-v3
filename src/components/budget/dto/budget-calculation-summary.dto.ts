import { Field, Float, Int, ObjectType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { type BudgetCalcResult } from '../budget-calculation.service';

/**
 * GraphQL projection of `BudgetCalcResult` (see `budget-calculation.service.ts`)
 * for one fiscal year. `budget-line-items-poc`.
 */
@ObjectType()
export class BudgetCalculationFiscalYear {
  @Field(() => Int, { description: 'e.g. 2025' })
  readonly fiscalYear: number;

  @Field({ description: 'e.g. "FY25"' })
  readonly label: string;

  @Field(() => Float)
  readonly cash: number;

  @Field(() => Float)
  readonly inKind: number;

  @Field(() => Float)
  readonly admin: number;

  @Field(() => Float)
  readonly grandTotal: number;

  @Field(() => Float)
  readonly totalCash: number;

  @Field(() => Float)
  readonly otherPartnerContributions: number;

  @Field(() => Float)
  readonly netToFunder: number;

  @Field(() => Float, {
    nullable: true,
    description: 'Null when the budget has no country/admin-fee-cap set.',
  })
  readonly adminFeeCap: number | null;
}

/** Same monetary shape as `BudgetCalculationFiscalYear`, summed across all fiscal years. */
@ObjectType()
export class BudgetCalculationTotals {
  @Field(() => Float)
  readonly cash: number;

  @Field(() => Float)
  readonly inKind: number;

  @Field(() => Float)
  readonly admin: number;

  @Field(() => Float)
  readonly grandTotal: number;

  @Field(() => Float)
  readonly totalCash: number;

  @Field(() => Float)
  readonly otherPartnerContributions: number;

  @Field(() => Float)
  readonly netToFunder: number;

  @Field(() => Float, { nullable: true })
  readonly adminFeeCap: number | null;
}

@ObjectType({
  description: stripIndent`
    The field-budget calculation engine's rollup for a budget — ported 1:1
    from the field-budget prototype's \`compute()\` (see
    \`BudgetCalculationService.computeBudget\`). Computed on every read, never
    stored.
  `,
})
export class BudgetCalculationSummary {
  @Field(() => [BudgetCalculationFiscalYear])
  readonly fiscalYears: readonly BudgetCalculationFiscalYear[];

  @Field(() => BudgetCalculationTotals)
  readonly totals: BudgetCalculationTotals;

  @Field(() => Float)
  readonly bibleTranslationPercent: number;

  @Field(() => Float)
  readonly funderBibleTranslationPercent: number;

  @Field(() => Float, {
    description:
      'Cost per language, prorated to an annualized figure. (Internship ' +
      "cost-per-intern mode isn't part of this POC.)",
  })
  readonly costPerLanguage: number;

  @Field({
    description:
      'True if the computed admin fee hit the country cap in at least one fiscal year.',
  })
  readonly capped: boolean;
}

const sum = (arr: readonly number[]): number => arr.reduce((a, b) => a + b, 0);

/**
 * Maps the calc engine's parallel-array `BudgetCalcResult` to the GraphQL
 * per-fiscal-year + totals shape above. Pure function — no I/O.
 */
export function toBudgetCalculationSummary(
  result: BudgetCalcResult,
): BudgetCalculationSummary {
  const { fiscalYears: fy } = result;

  const fiscalYears: BudgetCalculationFiscalYear[] = fy.labels.map(
    (label, i) => ({
      fiscalYear: fy.startFiscalYear + i,
      label,
      cash: result.cash[i] ?? 0,
      inKind: result.inKind[i] ?? 0,
      admin: result.admin[i] ?? 0,
      grandTotal: result.grandTotal[i] ?? 0,
      totalCash: result.totalCash[i] ?? 0,
      otherPartnerContributions: result.otherPartnerContributions[i] ?? 0,
      netToFunder: result.netToFunder[i] ?? 0,
      adminFeeCap: result.adminFeeCap ? (result.adminFeeCap[i] ?? 0) : null,
    }),
  );

  const totals: BudgetCalculationTotals = {
    cash: sum(result.cash),
    inKind: sum(result.inKind),
    admin: sum(result.admin),
    grandTotal: sum(result.grandTotal),
    totalCash: sum(result.totalCash),
    otherPartnerContributions: sum(result.otherPartnerContributions),
    netToFunder: sum(result.netToFunder),
    adminFeeCap: result.adminFeeCap ? sum(result.adminFeeCap) : null,
  };

  return {
    fiscalYears,
    totals,
    bibleTranslationPercent: result.bibleTranslationPercent,
    funderBibleTranslationPercent: result.funderBibleTranslationPercent,
    costPerLanguage: result.costPerLanguage,
    capped: result.capped,
  };
}
