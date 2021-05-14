import {
  Args,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import {
  AnonSession,
  DateInterval,
  LoggedInSession,
  Session,
} from '../../common';
import { EngagementService } from '../engagement';
import { FileService, SecuredFile } from '../file';
import { ProjectService } from '../project';
import { IPeriodicReport, ReportType, UploadPeriodicReportInput } from './dto';
import { PeriodicReportService } from './periodic-report.service';

@Resolver(IPeriodicReport)
export class PeriodicReportResolver {
  constructor(
    private readonly service: PeriodicReportService,
    private readonly projects: ProjectService,
    private readonly engagements: EngagementService,
    private readonly files: FileService
  ) {}

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
  async syncReports(
    @LoggedInSession() session: Session
  ): Promise<IPeriodicReport[]> {
    const projects = await this.projects.listProjectsWithDateRange();
    const reports1 = await Promise.all(
      projects.flatMap((p) =>
        DateInterval.tryFrom(p.mouStart, p.mouEnd)
          .expandToFull('quarters')
          .difference()
          .flatMap((r) => r.splitBy({ quarters: 1 }))
          .flatMap((interval) => [
            this.service.create(
              {
                start: interval.start,
                end: interval.end,
                type: ReportType.Narrative,
                projectOrEngagementId: p.projectId,
              },
              session
            ),
          ])
      )
    );
    const reports2 = await Promise.all(
      projects.flatMap((p) =>
        DateInterval.tryFrom(p.mouStart, p.mouEnd)
          .expandToFull('months')
          .difference()
          .flatMap((r) => r.splitBy({ months: 1 }))
          .flatMap((interval) => [
            this.service.create(
              {
                start: interval.start,
                end: interval.end,
                type: ReportType.Financial,
                projectOrEngagementId: p.projectId,
              },
              session
            ),
          ])
      )
    );

    const engagements = await this.engagements.listEngagementsWithDateRange();
    const reports3 = await Promise.all(
      engagements.flatMap((engagement) =>
        (engagement.startDateOverride
          ? DateInterval.tryFrom(
              engagement.startDateOverride,
              engagement.endDateOverride
            )
          : DateInterval.tryFrom(engagement.startDate, engagement.endDate)
        )
          .expandToFull('quarters')
          .difference()
          .flatMap((r) => r.splitBy({ quarters: 1 }))
          .flatMap((interval) =>
            this.service.create(
              {
                start: interval.start,
                end: interval.end,
                type: ReportType.Progress,
                projectOrEngagementId: engagement.engagementId,
              },
              session
            )
          )
      )
    );
    return [...reports1, ...reports2, ...reports3];
  }

  @ResolveField(() => SecuredFile)
  async reportFile(
    @Parent() report: IPeriodicReport,
    @AnonSession() session: Session
  ): Promise<SecuredFile> {
    return await this.files.resolveDefinedFile(report.reportFile, session);
  }
}
