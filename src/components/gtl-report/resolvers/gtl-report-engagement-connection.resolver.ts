import {
  Args,
  ArgsType,
  Float,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { CalendarDate, DateField, ListArg } from '~/common';
import { Loader, type LoaderOf } from '~/core/data-loader';
import { InternshipEngagement } from '../../engagement/dto';
import {
  PeriodicReportLoader,
  PeriodicReportService,
} from '../../periodic-report';
import { PeriodicReportListInput, ReportType } from '../../periodic-report/dto';
import { GtlReportList, SecuredGTLReport } from '../dto';

@ArgsType()
class PeriodicReportArgs {
  @DateField()
  date: CalendarDate;
}

/**
 * The GTL report fields on an Internship engagement, mirroring the
 * `progressReport*` fields LanguageEngagement has.
 *
 * Lives in the gtl-report module rather than the engagement module so the
 * dependency runs one way — the same reason
 * `ProgressReportEngagementConnectionResolver` sits under progress-report.
 */
@Resolver(InternshipEngagement)
export class GtlReportEngagementConnectionResolver {
  constructor(private readonly service: PeriodicReportService) {}

  @ResolveField(() => GtlReportList)
  async gtlReports(
    @Parent() engagement: InternshipEngagement,
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
    @Parent() engagement: InternshipEngagement,
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
    @Parent() engagement: InternshipEngagement,
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
    @Parent() engagement: InternshipEngagement,
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
    @Parent() engagement: InternshipEngagement,
  ): Promise<SecuredGTLReport> {
    const value = await this.service.getNextReportDue(
      engagement.id,
      ReportType.GTL,
    );
    return { canEdit: false, canRead: true, value };
  }

  @ResolveField(() => Float, {
    nullable: true,
    description: 'Elapsed time in the program, as a percentage',
  })
  programProgress(@Parent() engagement: InternshipEngagement): number | null {
    // The parent here is the secured DTO, so its dates are wrapped — this
    // cannot use `engagementRange`, which takes the unsecured shape. Null until
    // both dates are known (and readable). Plain date arithmetic rather than a
    // DateInterval: luxon is configured to throw on an invalid interval, and an
    // end date before the start date is bad data to report null for, not an
    // error to surface here.
    const start = engagement.startDate.value;
    const end = engagement.endDate.value;
    if (!start || !end) {
      return null;
    }
    const total = end.diff(start, 'days').days;
    if (total <= 0) {
      return null;
    }
    // Clamped: an engagement that has not started yet, or one that has run past
    // its end date, are both ordinary states, not errors.
    const elapsed = CalendarDate.local().diff(start, 'days').days;
    return Math.min(100, Math.max(0, (elapsed / total) * 100));
  }
}
