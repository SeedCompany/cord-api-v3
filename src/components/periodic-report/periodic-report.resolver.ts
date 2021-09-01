import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import {
  AnonSession,
  CalendarDate,
  ID,
  IdArg,
  LoggedInSession,
  Session,
} from '../../common';
import { FileService, SecuredDirectory, SecuredFile } from '../file';
import {
  IPeriodicReport,
  PeriodicReport,
  ReportType,
  UpdatePeriodicReportInput,
} from './dto';
import { UploadPeriodicReportInput } from './dto/upload-periodic-report.dto';
import { PeriodicReportService } from './periodic-report.service';

@Resolver(IPeriodicReport)
export class PeriodicReportResolver {
  constructor(
    private readonly service: PeriodicReportService,
    private readonly files: FileService
  ) {}

  @Query(() => IPeriodicReport, {
    description: 'Look up a report by its ID',
  })
  async periodicReport(
    @IdArg() id: ID,
    @AnonSession() session: Session
  ): Promise<IPeriodicReport> {
    const report = await this.service.readOne(id, session);
    return report;
  }

  @ResolveField(() => CalendarDate, {
    description: 'When this report is due',
  })
  due(@Parent() report: IPeriodicReport) {
    return report.end.plus({ month: 1 }).endOf('month');
  }

  @Mutation(() => IPeriodicReport, {
    description: 'Update a report file',
    deprecationReason: 'Moved to progress-report resolver',
  })
  async uploadPeriodicReport(
    @LoggedInSession() session: Session,
    @Args('input') { reportId: id, file: pnp }: UploadPeriodicReportInput
  ): Promise<IPeriodicReport> {
    return await this.service.update({ id, pnp }, session);
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

  @ResolveField(() => SecuredFile, {
    description:
      'Returns Pnp file for progress report. Otherwise returns first report file of directory',
    deprecationReason:
      "Use directory or progress report's pnp resolver instead",
  })
  async reportFile(
    @Parent() report: PeriodicReport,
    @AnonSession() session: Session
  ): Promise<SecuredFile> {
    const { value: directoryId, ...rest } = report.directory;
    if (!rest.canRead || !directoryId) {
      return rest;
    }

    if (report.type === ReportType.Progress) {
      return await this.files.resolveDefinedFile(report.pnp, session);
    } else {
      const children = await this.files.listChildren(
        directoryId,
        undefined,
        session
      );

      const item = children.items[0];
      const file = await this.files.getFile(item.id, session); // TODO: is there a better way to pass `children.items[0]` to the value directly with typechecking passed?
      return {
        ...rest,
        value: file,
      };
    }
  }

  @ResolveField(() => SecuredDirectory)
  async directory(
    @Parent() report: IPeriodicReport,
    @AnonSession() session: Session
  ): Promise<SecuredDirectory> {
    const { value: directoryId, ...rest } = report.directory;
    if (!rest.canRead || !directoryId) {
      return rest;
    }

    return {
      ...rest,
      value: await this.files.getDirectory(directoryId, session),
    };
  }
}
