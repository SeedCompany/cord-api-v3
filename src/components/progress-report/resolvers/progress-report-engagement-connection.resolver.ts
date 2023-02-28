import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { AnonSession, ListArg, Session } from '~/common';
import { Loader, LoaderOf } from '~/core';
import { Engagement, LanguageEngagement } from '../../engagement/dto';
import {
  PeriodicReportLoader,
  PeriodicReportService,
} from '../../periodic-report';
import {
  PeriodicReportListInput,
  ReportType,
  SecuredPeriodicReport,
} from '../../periodic-report/dto';
import { ProgressReportList, SecuredProgressReport } from '../dto';

@Resolver(LanguageEngagement)
export class ProgressReportEngagementConnectionResolver {
  constructor(private readonly service: PeriodicReportService) {}

  @ResolveField(() => ProgressReportList)
  async progressReports(
    @AnonSession() session: Session,
    @Parent() engagement: Engagement,
    @ListArg(PeriodicReportListInput) input: PeriodicReportListInput,
    @Loader(PeriodicReportLoader)
    periodicReports: LoaderOf<PeriodicReportLoader>,
  ): Promise<ProgressReportList> {
    const list = await this.service.list(session, {
      ...input,
      parent: engagement.id,
      type: ReportType.Progress,
    });
    periodicReports.primeAll(list.items);
    return list as ProgressReportList;
  }

  @ResolveField(() => SecuredProgressReport, {
    description:
      'The progress report currently due. This is the period that most recently completed.',
  })
  async currentProgressReportDue(
    @AnonSession() session: Session,
    @Parent() engagement: Engagement,
  ): Promise<SecuredProgressReport> {
    const value = await this.service.getCurrentReportDue(
      engagement.id,
      ReportType.Progress,
      session,
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
    @Parent() engagement: Engagement,
  ): Promise<SecuredProgressReport> {
    const value = await this.service.getLatestReportSubmitted(
      engagement.id,
      ReportType.Progress,
      session,
    );
    return {
      canEdit: false,
      canRead: true,
      value,
    };
  }

  @ResolveField(() => SecuredProgressReport, {
    description:
      'The progress report due next. This is the period currently in progress.',
  })
  async nextProgressReportDue(
    @AnonSession() session: Session,
    @Parent() engagement: Engagement,
  ): Promise<SecuredProgressReport> {
    const value = await this.service.getNextReportDue(
      engagement.id,
      ReportType.Progress,
      session,
    );
    return {
      canEdit: false,
      canRead: true,
      value,
    };
  }
}
