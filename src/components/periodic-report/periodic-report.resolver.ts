import {
  Args,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { CalendarDate, LoggedInSession, Session } from '../../common';
import { Loader, LoaderOf } from '../../core';
import { FileNodeLoader, resolveDefinedFile, SecuredFile } from '../file';
import {
  IPeriodicReport,
  UpdatePeriodicReportInput,
  UploadPeriodicReportInput,
} from './dto';
import { PeriodicReportService } from './periodic-report.service';

@Resolver(IPeriodicReport)
export class PeriodicReportResolver {
  constructor(private readonly service: PeriodicReportService) {}

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
    @Args('input') { reportId: id, file: reportFile }: UploadPeriodicReportInput
  ): Promise<IPeriodicReport> {
    return await this.service.update({ id, reportFile }, session);
  }

  @Mutation(() => IPeriodicReport, {
    description: 'Update a report',
  })
  async updatePeriodicReport(
    @LoggedInSession() session: Session,
    @Args('input') input: UpdatePeriodicReportInput
  ): Promise<IPeriodicReport> {
    return await this.service.update(input, session);
  }

  @ResolveField(() => SecuredFile)
  async reportFile(
    @Parent() report: IPeriodicReport,
    @Loader(FileNodeLoader) files: LoaderOf<FileNodeLoader>
  ): Promise<SecuredFile> {
    return await resolveDefinedFile(files, report.reportFile);
  }
}
