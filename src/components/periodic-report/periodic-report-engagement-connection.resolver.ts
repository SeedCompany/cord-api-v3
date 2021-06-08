import { Args, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { AnonSession, Session } from '../../common';
import { Engagement, LanguageEngagement } from '../engagement/dto';
import {
  PeriodicReportListInput,
  ReportType,
  SecuredPeriodicReport,
  SecuredPeriodicReportList,
} from './dto';
import { PeriodicReportService } from './periodic-report.service';

@Resolver(LanguageEngagement)
export class PeriodicReportEngagementConnectionResolver {
  constructor(private readonly service: PeriodicReportService) {}

  @ResolveField(() => SecuredPeriodicReportList)
  async progressReports(
    @AnonSession() session: Session,
    @Parent() engagement: Engagement,
    @Args({
      name: 'input',
      type: () => PeriodicReportListInput,
      defaultValue: PeriodicReportListInput.defaultVal,
    })
    input: PeriodicReportListInput
  ): Promise<SecuredPeriodicReportList> {
    return this.service.listEngagementReports(engagement.id, input, session);
  }

  @ResolveField(() => SecuredPeriodicReport, {
    description:
      'The progress report currently due. This is the period that most recently completed.',
  })
  async currentProgressReportDue(
    @AnonSession() session: Session,
    @Parent() engagement: Engagement
  ): Promise<SecuredPeriodicReport> {
    const value = await this.service.getCurrentReportDue(
      engagement.id,
      ReportType.Progress,
      session
    );
    return {
      canEdit: false,
      canRead: true,
      value,
    };
  }

  @ResolveField(() => SecuredPeriodicReport, {
    description: 'The latest progress report that has a report submitted',
  })
  async latestProgressReportSubmitted(
    @AnonSession() session: Session,
    @Parent() engagement: Engagement
  ): Promise<SecuredPeriodicReport> {
    const value = await this.service.getLatestReportSubmitted(
      engagement.id,
      ReportType.Progress,
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
      'The progress report due next. This is the period currently in progress.',
  })
  async nextProgressReportDue(
    @AnonSession() session: Session,
    @Parent() engagement: Engagement
  ): Promise<SecuredPeriodicReport> {
    const value = await this.service.getNextReportDue(
      engagement.id,
      ReportType.Progress,
      session
    );
    return {
      canEdit: false,
      canRead: true,
      value,
    };
  }
}
