import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Loader, LoaderOf } from '../../core';
import { ProgressReport } from '../progress-report/dto';
import { ProgressSummary, SummaryPeriod } from './dto';
import { ProgressSummaryLoader } from './progress-summary.loader';

@Resolver(ProgressReport)
export class ProgressReportConnectionResolver {
  @ResolveField(() => ProgressSummary, {
    nullable: true,
    description:
      'Progress of the engagement (all products/goals) made _only during this reporting period_',
  })
  async periodSummary(
    @Loader(ProgressSummaryLoader) loader: LoaderOf<ProgressSummaryLoader>,
    @Parent() report: ProgressReport,
  ): Promise<ProgressSummary | undefined> {
    return await this.fetch(loader, report, SummaryPeriod.ReportPeriod);
  }

  @ResolveField(() => ProgressSummary, {
    nullable: true,
    description:
      'Progress of the engagement (all products/goals) made from the beginning of _this fiscal year_ until this report',
  })
  async fiscalYearSummary(
    @Loader(ProgressSummaryLoader) loader: LoaderOf<ProgressSummaryLoader>,
    @Parent() report: ProgressReport,
  ): Promise<ProgressSummary | undefined> {
    return await this.fetch(loader, report, SummaryPeriod.FiscalYearSoFar);
  }

  @ResolveField(() => ProgressSummary, {
    nullable: true,
    description:
      'Progress of the engagement (all products/goals) made from the beginning of _the engagement_ until this report',
  })
  async cumulativeSummary(
    @Loader(ProgressSummaryLoader) loader: LoaderOf<ProgressSummaryLoader>,
    @Parent() report: ProgressReport,
  ): Promise<ProgressSummary | undefined> {
    return await this.fetch(loader, report, SummaryPeriod.Cumulative);
  }

  private async fetch(
    loader: LoaderOf<ProgressSummaryLoader>,
    report: ProgressReport,
    period: SummaryPeriod,
  ): Promise<ProgressSummary | undefined> {
    const fetched = await loader.load(report.id);
    if (!fetched[period]) {
      return undefined;
    }
    return {
      ...fetched[period]!,
      totalVerses: fetched.totalVerses,
      totalVerseEquivalents: fetched.totalVerseEquivalents,
    };
  }
}
