import {
  Args,
  Float,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { sumBy } from 'lodash';
import { type ID, SecuredInt } from '~/common';
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
  CONSULTANT_ACCOUNT,
  type CostType,
  type CurrencyMode,
  DEFAULT_CONSULTANT_TYPE,
  padToLength,
  ROLE_MAP,
  SALARY_ACCTS,
} from './budget-calculation.service';
import { BudgetDerivedFieldsService } from './budget-derived-fields.service';
import { BudgetReferenceKeystoneRateRepository } from './budget-reference-keystone-rate.repository';
import {
  Budget,
  BudgetBenchmarkInput,
  BudgetBenchmarkResult,
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
    private readonly derived: BudgetDerivedFieldsService,
    private readonly keystoneRates: BudgetReferenceKeystoneRateRepository,
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

  @ResolveField(() => SecuredBudgetReferenceCountry, {
    description: stripIndent`
      Purely derived from the project's \`primaryLocation\` — no longer
      directly settable (see the doc comment on the underlying \`country\`
      property in \`dto/budget.dto.ts\`). Null if the project has no
      \`primaryLocation\`, that location isn't a \`Country\`-type location,
      its \`isoAlpha3\` is unset, or no matching \`budget_reference_countries\`
      row exists for that ISO code.
    `,
  })
  async country(
    @Parent() budget: Budget,
  ): Promise<SecuredBudgetReferenceCountry> {
    const { canRead, canEdit } = budget.country;
    if (!canRead) {
      return { canRead, canEdit };
    }
    const projectId = budget.parent.properties.id as ID<'Project'>;
    const value = await this.derived.resolveCountry(projectId);
    return { canRead, canEdit, value };
  }

  @ResolveField(() => SecuredInt, {
    description: stripIndent`
      Number of languages this budget covers — used for cost-per-language.
      Purely derived from the count of the project's Language Engagements
      (\`type: "language"\`), no longer directly settable. Falls back to 1 in
      \`BudgetCalculationService\` when this is 0 (a project with no language
      engagements yet).
    `,
  })
  async languageCount(@Parent() budget: Budget): Promise<SecuredInt> {
    const { canRead, canEdit } = budget.languageCount;
    if (!canRead) {
      return { canRead, canEdit };
    }
    const projectId = budget.parent.properties.id as ID<'Project'>;
    const value = await this.derived.countLanguageEngagements(projectId);
    return { canRead, canEdit, value };
  }

  /**
   * NOTE: named `calculationSummary`, not `summary` — `Budget.summary`
   * already exists above (`BudgetSummary`: `hasPreApproved` /
   * `preApprovedExceeded`), a pre-existing field with an unrelated shape.
   * Reusing that name for the calc engine's rollup would either collide with
   * or silently change that existing field's type, which is a bigger,
   * unrequested breaking change than adding a clearly-named sibling field.
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
  ): Promise<BudgetCalculationSummary | null> {
    // `parent` is the Neo4j-era `BaseNode` shape (`.properties.id`) —
    // `BudgetDrizzleRepository.toDto` constructs a real BaseNode-shaped value
    // here (see its comments) specifically so `ChangesetAwareResolver.parent`
    // (a separate, generic `@ResolveField` shared by every ChangesetAware
    // resource) can resolve it without crashing.
    const projectId = budget.parent.properties.id as ID<'Project'>;
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

    // Both derived fresh here rather than read off `budget.country.value` /
    // `budget.languageCount.value` — those raw dto properties are stale
    // (`country`) or simply the old stored default (`languageCount`) now
    // that both fields are purely server-derived (see `BudgetDerivedFieldsService`).
    const country = await this.derived.resolveCountry(projectId);
    const languageCount =
      (await this.derived.countLanguageEngagements(projectId)) || 1;

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
      // hydration lands upstream (see project.drizzle.repository.ts).
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
      languageCount,
      adminFeePercent: budget.adminFeePercent.value ?? 0,
    };

    const lines: BudgetCalcLine[] = budget.lineItems.map((li) => ({
      type: (li.type.value as 'line' | 'header' | undefined) ?? 'line',
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

  /**
   * Server-side benchmark/keystone calculator (budget-line-items-poc phase
   * 3) — the GraphQL equivalent of the prototype's benchmark-calculator
   * modal (`resolveCalcParams()` / `previewKeystone()` / `applyModal()` in
   * its `src/app.js`). Never exposes the underlying reference country/rate
   * data itself (see `BudgetReferenceKeystoneRateRepository`'s doc comment)
   * — only the computed figures.
   *
   * Sensitivity masking is intentionally NOT applied here — see
   * `BudgetBenchmarkResult`'s doc comment.
   */
  @Query(() => BudgetBenchmarkResult, {
    nullable: true,
    description: stripIndent`
      Server-side benchmark/keystone calculator. Null when: the budget's
      project has no start/end dates yet; the budget has no resolvable
      country (see \`Budget.country\`) or that country has no cost-of-living
      index configured; \`input.account\` (or, for the consultant account,
      \`input.consultantType\`) doesn't map to a known role; or no keystone
      rate is seeded for that (country, role) pair. All are expected,
      recoverable "can't compute this yet" states, not errors.
    `,
  })
  async budgetBenchmark(
    @Args('input') input: BudgetBenchmarkInput,
    @Loader(() => ProjectLoader) projects: LoaderOf<ProjectLoader>,
  ): Promise<BudgetBenchmarkResult | null> {
    const budget = await this.service.readOne(input.budget);
    const projectId = budget.parent.properties.id as ID<'Project'>;

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

    const country = await this.derived.resolveCountry(projectId);
    if (!country?.keystoneCountryName) {
      return null;
    }
    if (country.costOfLivingIndex == null) {
      return null;
    }

    const roleLabel =
      input.account === CONSULTANT_ACCOUNT
        ? ROLE_MAP[input.consultantType ?? DEFAULT_CONSULTANT_TYPE]
        : ROLE_MAP[input.account];
    if (!roleLabel) {
      return null;
    }

    const weeklyRateUsd = await this.keystoneRates.findRate(
      country.keystoneCountryName,
      roleLabel,
    );
    if (weeklyRateUsd == null) {
      return null;
    }

    const entryCurrencyMode =
      (budget.entryCurrencyMode.value as CurrencyMode | undefined) ?? 'USD';
    const exchangeRate = budget.exchangeRate.value ?? 1;
    const inflationRate = budget.inflationRate.value ?? 0;

    const figure = this.calc.keystoneFigure(
      country.costOfLivingIndex,
      weeklyRateUsd,
      entryCurrencyMode,
      exchangeRate,
    );

    const isSalary = (SALARY_ACCTS as readonly string[]).includes(
      input.account,
    );

    let weeklyOrAnnualFigure: number;
    let amounts: number[];
    if (isSalary) {
      const weeks = padToLength(input.weeksPerFiscalYear ?? [], fy.duration);
      amounts = this.calc.spreadKeystoneSalary(weeks, figure, inflationRate);
      weeklyOrAnnualFigure = figure;
    } else {
      // SERVICE_ACCTS: annual figure = keystone figure × languageCount, then
      // spread across fiscal years the same way any other annual amount is
      // (`spreadAnnual`, already ported in `BudgetCalculationService`).
      const languageCount =
        (await this.derived.countLanguageEngagements(projectId)) || 1;
      const annual = figure * languageCount;
      amounts = this.calc.spreadAnnual(annual, fy, inflationRate);
      weeklyOrAnnualFigure = annual;
    }

    const fiscalYearAmounts: Record<string, number> = {};
    amounts.forEach((amount, i) => {
      fiscalYearAmounts[String(fy.startFiscalYear + i)] = amount;
    });

    return { weeklyOrAnnualFigure, fiscalYearAmounts };
  }
}
