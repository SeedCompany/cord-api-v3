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

  @Mutation(() => [Boolean], {
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
      if (!mouStart || !mouEnd) {
        this.logger.log('missing mou date(s)', projectId);
        return;
      }
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
    await asyncPool(10, projects, syncProject);

    return true;
  }

  @Mutation(() => [Boolean], {
    description: 'Create engagement progress reports for existing engagements',
  })
  async syncEngagementReports(@LoggedInSession() session: Session) {
    const getFyFromCalendarDate = (cd: CalendarDate) => {
      const month = cd.month;
      return month >= 10 ? cd.year + 1 : cd.year;
    };
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
      if (!startDate || !endDate) {
        this.logger.log('missing project date(s)', engagementId);
        return;
      }
      const noOverrides = !startDateOverride && !endDateOverride;
      const missingEndOverride = startDateOverride && !endDateOverride;
      const wrongEndOverride =
        startDateOverride &&
        endDateOverride &&
        startDateOverride.toMillis() > endDateOverride.toMillis();
      if (missingEndOverride || wrongEndOverride) {
        if (!startDate) {
          this.logger.log(
            'no start override or start date on project',
            engagementId
          );
          return;
        }
        // startDateOverride will always be defined here
        const startDateOverrideFy = getFyFromCalendarDate(startDateOverride!);
        const startDateFy = getFyFromCalendarDate(startDate);
        if (startDateOverrideFy !== startDateFy) {
          this.logger.log(
            `cannot delete start date override since FY doesn't match project start on ${engagementId}`
          );
          return;
        }
        // per Seth, remove start date override if we have no end override (if missingEndOverride is true) and the FY of start override matches project start
        // there was bad data from v2 that got migrated
        // also if the end date override is before the start date override (if wrongEndOverride is true) remove them both
        const res = await this.engagements.updateLanguageEngagement(
          {
            id: engagementId,
            // these fields are nullable in fact, but since it's not coming through gql TS is complaining
            // hence the ts-ignore
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            startDateOverride: null,
            ...(wrongEndOverride ? { endDateOverride: null } : {}),
          },
          session
        );
        this.logger.log(
          `updated ${
            startDateOverride !== res.startDateOverride.value
              ? // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                `start date override from ${startDateOverride} to ${res.startDateOverride.value}`
              : endDateOverride !== res.endDateOverride.value
              ? // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                `end date override from ${endDateOverride} to ${res.endDateOverride.value}`
              : 'nothing'
          } on ${engagementId}`
        );
      }

      let intervals;

      if (noOverrides || missingEndOverride || wrongEndOverride) {
        intervals = DateInterval.tryFrom(startDate, endDate)
          .expandToFull('quarters')
          .difference()
          .flatMap((r) => r.splitBy({ quarters: 1 }));
      } else if (startDateOverride && endDateOverride) {
        intervals = DateInterval.tryFrom(startDateOverride, endDateOverride)
          .expandToFull('quarters')
          .difference()
          .flatMap((r) => r.splitBy({ quarters: 1 }));
      } else {
        this.logger.log({
          message: 'unable to create reports for engagement',
          id: engagementId,
          startOverride: startDateOverride,
          endOverride: endDateOverride,
          projectStart: startDate,
          projectEnd: endDate,
        });
        return;
      }

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
