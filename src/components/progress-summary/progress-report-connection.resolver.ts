import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { ProgressReport } from '../periodic-report';
import { ProgressSummary, SummaryPeriod } from './dto';
import { ProgressSummaryRepository } from './progress-summary.repository';

@Resolver(ProgressReport)
export class ProgressReportConnectionResolver {
  constructor(private readonly repo: ProgressSummaryRepository) {}

  @ResolveField(() => ProgressSummary, {
    nullable: true,
    description:
      'Progress of the engagement (all products/goals) made _only during this reporting period_',
  })
  async periodSummary(
    @Parent() report: ProgressReport
  ): Promise<ProgressSummary | undefined> {
    return await this.repo.readOne(report.id, SummaryPeriod.ReportPeriod);
  }

  @ResolveField(() => ProgressSummary, {
    nullable: true,
    description:
      'Progress of the engagement (all products/goals) made from the beginning of _this fiscal year_ until this report',
  })
  async fiscalYearSummary(
    @Parent() report: ProgressReport
  ): Promise<ProgressSummary | undefined> {
    return await this.repo.readOne(report.id, SummaryPeriod.FiscalYearSoFar);
  }

  @ResolveField(() => ProgressSummary, {
    nullable: true,
    description:
      'Progress of the engagement (all products/goals) made from the beginning of _the engagement_ until this report',
  })
  async cumulativeSummary(
    @Parent() report: ProgressReport
  ): Promise<ProgressSummary | undefined> {
    return await this.repo.readOne(report.id, SummaryPeriod.Cumulative);
  }

  @ResolveField(() => ProgressSummary, {
    nullable: true,
    deprecationReason: 'Use `ProgressReport.cumulativeSummary` instead',
  })
  async summary(
    @Parent() report: ProgressReport
  ): Promise<ProgressSummary | undefined> {
    return await this.cumulativeSummary(report);
  }
}
