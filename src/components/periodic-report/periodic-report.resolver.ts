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

  @ResolveField(() => CalendarDate, {
    description: 'When this report is due',
  })
  due(@Parent() report: IPeriodicReport) {
    return report.end.plus({ month: 1 }).endOf('month');
  }

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

  @Mutation(() => [IPeriodicReport], {
    description: 'Update a report file',
  })
  async syncReports(@LoggedInSession() session: Session) {
    const projects = await this.projects.listProjectsWithDateRange();

    const syncProject = async (project: any) => {
      const narrativeIntervals = DateInterval.tryFrom(
        project.mouStart,
        project.mouEnd
      )
        .expandToFull('quarters')
        .difference()
        .flatMap((r) => r.splitBy({ quarters: 1 }));

      const financialIntervals = DateInterval.tryFrom(
        project.mouStart,
        project.mouEnd
      )
        .expandToFull('months')
        .difference()
        .flatMap((r) => r.splitBy({ months: 1 }));
      for (const interval of financialIntervals) {
        await this.service.create(
          {
            start: interval.start,
            end: interval.end,
            type: ReportType.Financial,
            projectOrEngagementId: project.projectId,
          },
          session
        );
      }

      for (const interval of narrativeIntervals) {
        await this.service.create(
          {
            start: interval.start,
            end: interval.end,
            type: ReportType.Narrative,
            projectOrEngagementId: project.projectId,
          },
          session
        );
      }
    };
    await asyncPool(10, projects, syncProject);

    const syncEngagement = async (engagement: any) => {
      const intervals = (engagement.startDateOverride
        ? DateInterval.tryFrom(
            engagement.startDateOverride,
            engagement.endDateOverride
          )
        : DateInterval.tryFrom(engagement.startDate, engagement.endDate)
      )
        .expandToFull('quarters')
        .difference()
        .flatMap((r) => r.splitBy({ quarters: 1 }));

      for (const interval of intervals) {
        await this.service.create(
          {
            start: interval.start,
            end: interval.end,
            type: ReportType.Progress,
            projectOrEngagementId: engagement.engagementId,
          },
          session
        );
      }
    };

    const engagements = await this.engagements.listEngagementsWithDateRange();
    await asyncPool(10, engagements, syncEngagement);
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
