import {
  Args,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { AnonSession, LoggedInSession, Session } from '../../common';
import { FileService, SecuredFile } from '../file';
import { IPeriodicReport, ProgressReport } from './dto';
import { UploadPeriodicReportInput } from './dto/upload-periodic-report.dto';
import { PeriodicReportService } from './periodic-report.service';

@Resolver(ProgressReport)
export class ProgressReportResolver {
  constructor(
    private readonly files: FileService,
    private readonly service: PeriodicReportService
  ) {}

  @Mutation(() => IPeriodicReport, {
    description: 'Update a pnp file',
  })
  async uploadPeriodicReport(
    @LoggedInSession() session: Session,
    @Args('input') { reportId: id, file: pnp }: UploadPeriodicReportInput
  ): Promise<IPeriodicReport> {
    return await this.service.update({ id, pnp }, session);
  }

  @ResolveField(() => SecuredFile, {
    description:
      'Returns Pnp file for progress report. Otherwise returns first report file of directory',
  })
  async pnp(
    @Parent() report: ProgressReport,
    @AnonSession() session: Session
  ): Promise<SecuredFile> {
    const { value: directoryId, ...rest } = report.directory;
    if (!rest.canRead || !directoryId) {
      return rest;
    }

    return await this.files.resolveDefinedFile(report.pnp, session);
  }
}
