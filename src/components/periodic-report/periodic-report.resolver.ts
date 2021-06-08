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
  LoggedInSession,
  Session,
} from '../../common';
import { FileService, SecuredFile } from '../file';
import { IPeriodicReport, UploadPeriodicReportInput } from './dto';
import { PeriodicReportService } from './periodic-report.service';

@Resolver(IPeriodicReport)
export class PeriodicReportResolver {
  constructor(
    private readonly service: PeriodicReportService,
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

  @ResolveField(() => SecuredFile)
  async reportFile(
    @Parent() report: IPeriodicReport,
    @AnonSession() session: Session
  ): Promise<SecuredFile> {
    return await this.files.resolveDefinedFile(report.reportFile, session);
  }
}
