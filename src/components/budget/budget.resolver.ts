import {
  Args,
  Float,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { sumBy } from 'lodash';
import { type ID, mapSecuredValue } from '~/common';
import { Loader, type LoaderOf } from '~/core/data-loader';
import { BudgetService } from '../budget';
import { FileNodeLoader, resolveDefinedFile } from '../file';
import { SecuredFile } from '../file/dto';
import { ProjectLoader } from '../project';
import {
  type BudgetCalcConfig,
  type BudgetCalcLine,
  type BudgetCalcOtherPartnerContribution,
  BudgetCalculationService,
  type CostType,
  type CurrencyMode,
} from './budget-calculation.service';
import { BudgetReferenceCountryLoader } from './budget-reference-country.loader';
import {
  Budget,
  BudgetCalculationSummary,
  BudgetSummary,
  BudgetUpdated,
  SecuredBudgetReferenceCountry,
  toBudgetCalculationSummary,
  UpdateBudget,
} from './dto';

@Resolver(Budget)
export class BudgetResolver {
  constructor(
    private readonly service: BudgetService,
    private readonly calc: BudgetCalculationService,
  ) {}

  @ResolveField(() => Float)
  async total(@Parent() budget: Budget): Promise<number> {
    return sumBy(budget.records, (record) => record.amount.value ?? 0);
  }

  @ResolveField(() => SecuredFile, {
    description: 'The universal budget template',
  })
  async universalTemplateFile(
    @Parent() budget: Budget,
    @Loader(FileNodeLoader) files: LoaderOf<FileNodeLoader>,
  ): Promise<SecuredFile> {
    return await resolveDefinedFile(files, budget.universalTemplateFile);
  }

  @Mutation(() => BudgetUpdated, {
    description: 'Update a budget',
  })
  async updateBudget(
    @Args('input') input: UpdateBudget,
  ): Promise<BudgetUpdated> {
    const budget = await this.service.update(input);
    return { budget };
  }

  @ResolveField(() => BudgetSummary)
  summary(@Parent() budget: Budget): BudgetSummary {
    return {
      hasPreApproved: budget.records.some(
        (record) => record.preApprovedAmount.value != null,
      ),
      preApprovedExceeded: budget.records.some((record) => {
        const amount = record.amount.value;
        const preApproved = record.preApprovedAmount.value;
        return amount != null && preApproved != null && amount > preApproved;
      }),
    };
  }

  // ── budget-line-items-poc additions ──

  @ResolveField(() => SecuredBudgetReferenceCountry)
  async country(
    @Parent() budget: Budget,
    @Loader(BudgetReferenceCountryLoader)
    countries: LoaderOf<BudgetReferenceCountryLoader>,
  ): Promise<SecuredBudgetReferenceCountry> {
    return await mapSecuredValue(budget.country, (id) => countries.load(id));
  }

  /**
   * NOTE: named `calculationSummary`, not `summary` — `Budget.summary`
   * already exists above (`BudgetSummary`: `hasPreApproved` /
   * `preApprovedExceeded`), a pre-existing field with an unrelated shape.
   * Reusing that name for the calc engine's rollup would either collide with
   * or silently change that existing field's type, which is a bigger,
   * unrequested breaking change than adding a clearly-named sibling field.
   * See the final report's deviations section.
   */
  @ResolveField(() => BudgetCalculationSummary, {
    nullable: true,
    description:
      "The field-budget calculation engine's rollup (grand total, cash, " +
      'in-kind, admin, net-to-funder, etc, per fiscal year plus totals). ' +
      "Computed on read, not stored. Null when the project's start/end " +
      "dates aren't both set yet (fiscal years can't be determined).",
  })
  async calculationSummary(
    @Parent() budget: Budget,
    @Loader(() => ProjectLoader) projects: LoaderOf<ProjectLoader>,
    @Loader(BudgetReferenceCountryLoader)
    countries: LoaderOf<BudgetReferenceCountryLoader>,
  ): Promise<BudgetCalculationSummary | null> {
    // `parent` is typed as the Neo4j-era `BaseNode` (`.properties.id`), but
    // under the Postgres/Drizzle path (`BudgetDrizzleRepository.toDto`) it's
    // actually stored as the plain `{ id }` shape already used by every
    // other Drizzle-ported repo's `parent`/relation stubs — same pre-existing
    // type/runtime mismatch as the `splitDb(..., { postgres: ... as any })`
    // casts elsewhere in this module, not something introduced here.
    const projectId = (budget.parent as unknown as { id: ID<'Project'> }).id;
    const project = await projects.load({
      id: projectId,
      view: { active: true },
    });
    const startDate = project.mouStart.value;
    const endDate = project.mouEnd.value;
    if (!startDate || !endDate) {
      return null;
    }

    const fy = this.calc.computeFiscalYears(
      startDate.toISODate()!,
      endDate.toISODate()!,
    );
    if (!fy) {
      return null;
    }
    const toOrderedAmounts = (
      amounts: Record<string, number> | undefined,
    ): number[] =>
      Array.from(
        { length: fy.duration },
        (_, i) => amounts?.[String(fy.startFiscalYear + i)] ?? 0,
      );

    const countryId = budget.country.value;
    const country = countryId ? await countries.load(countryId) : null;

    const config: BudgetCalcConfig = {
      // `Project.primaryPartnership` is stubbed to `null` under the
      // Postgres/Drizzle path today (see project.drizzle.repository.ts) —
      // there's no reliable organization id to compare funder lines
      // against yet. Every line without an explicit `funder` is still
      // correctly treated as the primary funder's (see
      // BudgetCalculationService.computeBudget's `?? config.primaryFunderId`
      // fallback); only lines that set an explicit, different `funder`
      // would be mis-treated, and none can be today since nothing can ever
      // equal this placeholder. Wire this through once primaryPartnership
      // hydration lands upstream — flagged in the final report.
      primaryFunderId: '',
      startDate: startDate.toISODate()!,
      endDate: endDate.toISODate()!,
      sensitivity: budget.sensitivity,
      country: country
        ? {
            costOfLivingIndex: country.costOfLivingIndex,
            adminFeeCap: country.adminFeeCap,
          }
        : null,
      inflationRate: budget.inflationRate.value ?? 0,
      exchangeRate: budget.exchangeRate.value ?? 1,
      entryCurrencyMode:
        (budget.entryCurrencyMode.value as CurrencyMode | undefined) ?? 'USD',
      displayCurrencyMode:
        (budget.displayCurrencyMode.value as CurrencyMode | undefined) ?? 'USD',
      languageCount: budget.languageCount.value ?? 1,
      adminFeePercent: budget.adminFeePercent.value ?? 0,
    };

    const lines: BudgetCalcLine[] = budget.lineItems.map((li) => ({
      account: li.account.value ?? '',
      costType: (li.costType.value as CostType | undefined) ?? 'Cash',
      activity: li.activity.value ?? null,
      funderId: li.funder.value ?? null,
      fiscalYearAmounts: toOrderedAmounts(li.fiscalYearAmounts.value),
    }));

    const otherPartnerContributions: BudgetCalcOtherPartnerContribution[] =
      budget.otherPartnerContributions.map((opc) => ({
        fiscalYearAmounts: toOrderedAmounts(opc.fiscalYearAmounts.value),
      }));

    const result = this.calc.computeBudget(
      config,
      lines,
      otherPartnerContributions,
    );
    return result ? toBudgetCalculationSummary(result) : null;
  }
}
