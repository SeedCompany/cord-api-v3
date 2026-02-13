import {
  Args,
  ArgsType,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { CalendarDate, DateField, ListArg } from '~/common';
import { Loader, type LoaderOf } from '~/core/data-loader';
import { type Engagement, LanguageEngagement } from '../../engagement/dto';
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

@ArgsType()
class PeriodicReportArgs {
  @DateField()
  date: CalendarDate;
}

@Resolver(LanguageEngagement)
export class ProgressReportEngagementConnectionResolver {
  constructor(private readonly service: PeriodicReportService) {}

  @ResolveField(() => ProgressReportList)
  async progressReports(
    @Parent() engagement: Engagement,
    @ListArg(PeriodicReportListInput) input: PeriodicReportListInput,
    @Loader(PeriodicReportLoader)
    periodicReports: LoaderOf<PeriodicReportLoader>,
  ): Promise<ProgressReportList> {
    const list = await this.service.list({
      ...input,
      parent: engagement.id,
      type: ReportType.Progress,
    });
    periodicReports.primeAll(list.items);
    return list as ProgressReportList;
  }

  @ResolveField(() => SecuredProgressReport)
  async progressReport(
    @Parent() engagement: Engagement,
    @Args() { date }: PeriodicReportArgs,
  ): Promise<SecuredProgressReport> {
    const value = await this.service.getReportByDate(
      engagement.id,
      date,
      ReportType.Progress,
    );
    return { canEdit: false, canRead: true, value };
  }

  @ResolveField(() => SecuredProgressReport, {
    description:
      'The progress report currently due. This is the period that most recently completed.',
  })
  async currentProgressReportDue(
    @Parent() engagement: Engagement,
  ): Promise<SecuredProgressReport> {
    const value = await this.service.getCurrentReportDue(
      engagement.id,
      ReportType.Progress,
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
    @Parent() engagement: Engagement,
  ): Promise<SecuredProgressReport> {
    const value = await this.service.getLatestReportSubmitted(
      engagement.id,
      ReportType.Progress,
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
    @Parent() engagement: Engagement,
  ): Promise<SecuredProgressReport> {
    const value = await this.service.getNextReportDue(
      engagement.id,
      ReportType.Progress,
    );
    return {
      canEdit: false,
      canRead: true,
      value,
    };
  }
}
