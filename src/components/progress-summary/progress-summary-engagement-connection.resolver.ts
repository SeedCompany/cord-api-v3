import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { AnonSession, fiscalQuarter, fiscalYear, Session } from '../../common';
import { LanguageEngagement } from '../engagement/dto';
import { PeriodicReportService, ReportType } from '../periodic-report';
import { SummaryPeriod } from './dto';
import { PnpData } from './dto/pnp-data.dto';
import { ProgressSummaryRepository } from './progress-summary.repository';

@Resolver(LanguageEngagement)
export class ProgressSummaryEngagementConnectionResolver {
  constructor(
    private readonly repo: ProgressSummaryRepository,
    private readonly reports: PeriodicReportService
  ) {}

  @ResolveField(() => PnpData, {
    nullable: true,
    deprecationReason:
      'Use LanguageEngagement.latestProgressReportSubmitted.cumulativeSummary instead',
  })
  async pnpData(
    @Parent() engagement: LanguageEngagement,
    @AnonSession() session: Session
  ): Promise<PnpData | undefined> {
    const report = await this.reports.getLatestReportSubmitted(
      engagement.id,
      ReportType.Progress,
      session
    );
    if (!report) {
      return undefined;
    }

    const summary = await this.repo.readOne(
      report.id,
      SummaryPeriod.Cumulative
    );
    if (!summary) {
      return undefined;
    }

    return {
      progressPlanned: summary.planned,
      progressActual: summary.actual,
      variance: summary.actual - summary.planned,
      year: fiscalYear(report.start),
      quarter: fiscalQuarter(report.start),
    };
  }
}
