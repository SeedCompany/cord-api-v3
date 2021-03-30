import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { LoggedInSession, Session } from '../../common';
import { SecuredFile } from '../file';
import { UploadPeriodicReportInput, UploadPeriodicReportOutput } from './dto';
import { PeriodicReportService } from './periodic-report.service';

@Resolver()
export class PeriodicReportResolver {
  constructor(private readonly service: PeriodicReportService) {}

  @Mutation(() => SecuredFile, {
    description: 'Update a report file',
  })
  async uploadPeriodicReport(
    @LoggedInSession() session: Session,
    @Args('input') { input }: UploadPeriodicReportInput
  ): Promise<UploadPeriodicReportOutput> {
    const reportFile = await this.service.uploadFile(
      input.reportId,
      input.file,
      session
    );
    return { reportFile };
  }
}
