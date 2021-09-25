import { Args, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { AnonSession, Session } from '../../common';
import { Engagement, LanguageEngagement } from '../engagement/dto';
import {
  PeriodicReportListInput,
  PeriodicReportService,
  ReportType,
  SecuredPeriodicReport,
  SecuredPeriodicReportList,
} from '../periodic-report';

@Resolver(LanguageEngagement)
export class NarrativeReportEngagementConnectionResolver {
  constructor(private readonly reports: PeriodicReportService) {}

  @ResolveField(() => SecuredPeriodicReportList)
  async narrativeReports(
    @AnonSession() session: Session,
    @Parent() engagement: Engagement,
    @Args({
      name: 'input',
      type: () => PeriodicReportListInput,
      defaultValue: PeriodicReportListInput.defaultVal,
    })
    input: PeriodicReportListInput
  ): Promise<SecuredPeriodicReportList> {
    return await this.reports.list(
      engagement.id,
      ReportType.Narrative,
      input,
      session
    );
  }

  @ResolveField(() => SecuredPeriodicReport, {
    description:
      'The narrative report currently due. This is the period that most recently completed.',
  })
  async currentNarrativeReportDue(
    @AnonSession() session: Session,
    @Parent() engagement: Engagement
  ): Promise<SecuredPeriodicReport> {
    const value = await this.reports.getCurrentReportDue(
      engagement.id,
      ReportType.Narrative,
      session
    );
    return {
      canEdit: false,
      canRead: true,
      value,
    };
  }

  @ResolveField(() => SecuredPeriodicReport, {
    description: 'The latest narrative report that has a report submitted',
  })
  async latestNarrativeReportSubmitted(
    @AnonSession() session: Session,
    @Parent() engagement: Engagement
  ): Promise<SecuredPeriodicReport> {
    const value = await this.reports.getLatestReportSubmitted(
      engagement.id,
      ReportType.Narrative,
      session
    );
    return {
      canEdit: false,
      canRead: true,
      value,
    };
  }

  @ResolveField(() => SecuredPeriodicReport, {
    description:
      'The narrative report due next. This is the period currently in narrative.',
  })
  async nextNarrativeReportDue(
    @AnonSession() session: Session,
    @Parent() engagement: Engagement
  ): Promise<SecuredPeriodicReport> {
    const value = await this.reports.getNextReportDue(
      engagement.id,
      ReportType.Narrative,
      session
    );
    return {
      canEdit: false,
      canRead: true,
      value,
    };
  }
}
