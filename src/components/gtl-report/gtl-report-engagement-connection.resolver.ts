import {
  Args,
  ArgsType,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { CalendarDate, DateField, ListArg } from '~/common';
import { Loader, type LoaderOf } from '~/core/data-loader';
import { type Engagement, InternshipEngagement } from '../engagement/dto';
import {
  PeriodicReportLoader,
  PeriodicReportService,
} from '../periodic-report';
import { PeriodicReportListInput, ReportType } from '../periodic-report/dto';
import { GtlReportList, SecuredGTLReport } from './dto';

@ArgsType()
class PeriodicReportArgs {
  @DateField()
  date: CalendarDate;
}

/**
 * The report-due fields on a GTL engagement, mirroring the five
 * `progressReport*` fields LanguageEngagement has.
 *
 * Lives in the gtl-report module rather than the engagement one so the
 * dependency runs one way — the same reason
 * `ProgressReportEngagementConnectionResolver` sits under progress-report.
 */
@Resolver(InternshipEngagement)
export class GtlReportEngagementConnectionResolver {
  constructor(private readonly service: PeriodicReportService) {}

  @ResolveField(() => GtlReportList)
  async gtlReports(
    @Parent() engagement: Engagement,
    @ListArg(PeriodicReportListInput) input: PeriodicReportListInput,
    @Loader(PeriodicReportLoader)
    periodicReports: LoaderOf<PeriodicReportLoader>,
  ): Promise<GtlReportList> {
    const list = await this.service.list({
      ...input,
      parent: engagement.id,
      type: ReportType.GTL,
    });
    periodicReports.primeAll(list.items);
    return list as GtlReportList;
  }

  @ResolveField(() => SecuredGTLReport)
  async gtlReport(
    @Parent() engagement: Engagement,
    @Args() { date }: PeriodicReportArgs,
  ): Promise<SecuredGTLReport> {
    const value = await this.service.getReportByDate(
      engagement.id,
      date,
      ReportType.GTL,
    );
    return { canEdit: false, canRead: true, value };
  }

  @ResolveField(() => SecuredGTLReport, {
    description:
      'The GTL report currently due. This is the period that most recently completed.',
  })
  async currentGtlReportDue(
    @Parent() engagement: Engagement,
  ): Promise<SecuredGTLReport> {
    const value = await this.service.getCurrentReportDue(
      engagement.id,
      ReportType.GTL,
    );
    return { canEdit: false, canRead: true, value };
  }

  @ResolveField(() => SecuredGTLReport, {
    description: 'The latest GTL report that has a report submitted',
  })
  async latestGtlReportSubmitted(
    @Parent() engagement: Engagement,
  ): Promise<SecuredGTLReport> {
    const value = await this.service.getLatestReportSubmitted(
      engagement.id,
      ReportType.GTL,
    );
    return { canEdit: false, canRead: true, value };
  }

  @ResolveField(() => SecuredGTLReport, {
    description:
      'The GTL report due next. This is the period currently in progress.',
  })
  async nextGtlReportDue(
    @Parent() engagement: Engagement,
  ): Promise<SecuredGTLReport> {
    const value = await this.service.getNextReportDue(
      engagement.id,
      ReportType.GTL,
    );
    return { canEdit: false, canRead: true, value };
  }
}
