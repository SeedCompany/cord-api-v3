import { Logger } from '@nestjs/common';
import {
  Args,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import {
  AnonSession,
  CalendarDate,
  DateInterval,
  ID,
  LoggedInSession,
  Session,
} from '../../common';
import { EngagementService } from '../engagement';
import { FileService, SecuredFile } from '../file';
import { ProjectService } from '../project';
import { IPeriodicReport, ReportType, UploadPeriodicReportInput } from './dto';
import { PeriodicReportService } from './periodic-report.service';
// eslint-disable-next-line @typescript-eslint/no-require-imports
import asyncPool = require('tiny-async-pool');

@Resolver(IPeriodicReport)
export class PeriodicReportResolver {
  constructor(
    private readonly service: PeriodicReportService,
    private readonly projects: ProjectService,
    private readonly engagements: EngagementService,
    private readonly files: FileService
  ) {}

  private readonly logger = new Logger();

  @Mutation(() => IPeriodicReport, {
    description: 'Update a report file',
  })
  async uploadPeriodicReport(
    @LoggedInSession() session: Session,
    @Args('input') input: UploadPeriodicReportInput
  ): Promise<IPeriodicReport> {
    const report = await this.service.uploadFile(
      input.reportId,
      input.file,
      session
    );
    return report;
  }

  @Mutation(() => Boolean, {
    description: 'Create project report files for existing projects',
  })
  async syncProjectReports(@LoggedInSession() session: Session) {
    const projects = await this.projects.listProjectsWithDateRange();

    const syncProject = async ({
      projectId,
      mouStart,
      mouEnd,
    }: {
      projectId: ID;
      mouStart?: CalendarDate;
      mouEnd?: CalendarDate;
    }) => {
      // can't generate reports with no dates
      if (!mouStart || !mouEnd) return;

      const narrativeIntervals = DateInterval.tryFrom(mouStart, mouEnd)
        .expandToFull('quarters')
        .difference()
        .flatMap((r) => r.splitBy({ quarters: 1 }));

      const financialIntervals = DateInterval.tryFrom(mouStart, mouEnd)
        .expandToFull('months')
        .difference()
        .flatMap((r) => r.splitBy({ months: 1 }));
      for (const interval of financialIntervals) {
        try {
          await this.service.create(
            {
              start: interval.start,
              end: interval.end,
              type: ReportType.Financial,
              projectOrEngagementId: projectId,
            },
            session
          );
        } catch (e) {
          this.logger.log(e, projectId);
        }
      }

      for (const interval of narrativeIntervals) {
        try {
          await this.service.create(
            {
              start: interval.start,
              end: interval.end,
              type: ReportType.Narrative,
              projectOrEngagementId: projectId,
            },
            session
          );
        } catch (e) {
          this.logger.log(e, projectId);
        }
      }
    };
    await asyncPool(20, projects, syncProject);

    return true;
  }

  @Mutation(() => Boolean, {
    description: 'Create engagement progress reports for existing engagements',
  })
  async syncEngagementReports(@LoggedInSession() session: Session) {
    const syncEngagement = async ({
      engagementId,
      startDate,
      endDate,
      startDateOverride,
      endDateOverride,
    }: {
      engagementId: ID;
      startDate?: CalendarDate;
      endDate?: CalendarDate;
      startDateOverride?: CalendarDate;
      endDateOverride?: CalendarDate;
    }) => {
      // if we're missing either project date, don't generate reports
      if (!startDate || !endDate) return;

      const useStartOverride =
        startDateOverride &&
        // override must come after the project start
        startDateOverride.toMillis() > startDate.toMillis() &&
        // can't have an override outside of the limits of the project dates
        startDateOverride.toMillis() < endDate.toMillis();

      const useEndOverride =
        endDateOverride &&
        // override must come before the project end
        endDateOverride.toMillis() < endDate.toMillis() &&
        // there's some bad data where we have end overrides
        // that are before either the project start or the override start
        // it must come after the project start
        endDateOverride.toMillis() > startDate.toMillis();

      const deleteStartOverride = startDateOverride && !useStartOverride;
      const deleteEndOverride = endDateOverride && !useEndOverride;
      const deleteBothOverrides =
        startDateOverride &&
        endDateOverride &&
        // invalid end override in relation to the start override
        endDateOverride.toMillis() < startDateOverride.toMillis();

      // the start date to use to generate the periodic reports
      const start =
        useStartOverride && !deleteBothOverrides
          ? startDateOverride
          : startDate;

      const end =
        useEndOverride && !deleteBothOverrides ? endDateOverride : endDate;

      if (deleteStartOverride || deleteEndOverride || deleteBothOverrides) {
        await this.engagements.updateLanguageEngagement(
          {
            id: engagementId,
            // these fields are nullable in fact, but since it's not coming through gql TS is complaining
            ...(deleteStartOverride || deleteBothOverrides
              ? { startDateOverride: null as any }
              : {}),
            ...(deleteEndOverride || deleteBothOverrides
              ? { endDateOverride: null as any }
              : {}),
          },
          session
        );
      }

      // // dependant booleans of start, end check for non-nullishness already
      const intervals = DateInterval.tryFrom(start!, end!)
        .expandToFull('quarters')
        .difference()
        .flatMap((r) => r.splitBy({ quarters: 1 }));

      for (const interval of intervals) {
        try {
          await this.service.create(
            {
              start: interval.start,
              end: interval.end,
              type: ReportType.Progress,
              projectOrEngagementId: engagementId,
            },
            session
          );
        } catch (e) {
          this.logger.log(e, engagementId);
        }
      }
    };

    const engagements = await this.engagements.listEngagementsWithDateRange();
    await asyncPool(20, engagements, syncEngagement);

    return true;
  }

  @ResolveField(() => SecuredFile)
  async reportFile(
    @Parent() report: IPeriodicReport,
    @AnonSession() session: Session
  ): Promise<SecuredFile> {
    return await this.files.resolveDefinedFile(report.reportFile, session);
  }
}
