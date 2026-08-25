import {
  Args,
  ArgsType,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import {
  CalendarDate,
  DateField,
  DateInterval,
  ListArg,
  SecuredFloatNullable,
} from '~/common';
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

  @ResolveField(() => SecuredFloatNullable, {
    description: `
      How far through the program this Global Translation Leader is, 0-100.

      Purely elapsed time between the engagement's start and end — it says
      nothing about how much of the growth plan is done. Null until both dates
      are known. Computed, never stored.
    `,
  })
  programProgress(@Parent() engagement: Engagement): SecuredFloatNullable {
    // The parent here is the SECURED dto, so its dates are wrapped — this can't
    // use `engagementRange`, which takes the unsecured shape.
    const range = DateInterval.tryFrom(
      engagement.startDate.value,
      engagement.endDate.value,
    );
    if (!range?.isValid) {
      return { canEdit: false, canRead: true, value: null };
    }
    const total = range.length('days');
    if (total <= 0) {
      return { canEdit: false, canRead: true, value: null };
    }
    // Clamped rather than interval-based: an engagement that has not started
    // yet would make an inverted interval, and one that has run over would make
    // an out-of-range one. Both are ordinary states, not errors.
    const now = CalendarDate.now();
    const elapsed = now.diff(range.start, 'days').days;
    const pct = (elapsed / total) * 100;
    return {
      canEdit: false,
      canRead: true,
      value: Math.round(Math.min(100, Math.max(0, pct))),
    };
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
