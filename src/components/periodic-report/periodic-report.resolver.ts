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
  ListArg,
  LoggedInSession,
  Session,
  UnauthorizedException,
} from '../../common';
import { Loader, LoaderOf } from '../../core';
import { IdsAndView, IdsAndViewArg } from '../changeset/dto';
import {
  FileNodeLoader,
  FileService,
  resolveDefinedFile,
  SecuredDirectory,
  SecuredFile,
} from '../file';
import {
  IPeriodicReport,
  PeriodicReportListInput,
  PeriodicReportListOutput,
  UpdatePeriodicReportInput,
  UploadPeriodicReportInput,
} from './dto';
import { PeriodicReportLoader as ReportLoader } from './periodic-report.loader';
import { PeriodicReportService } from './periodic-report.service';

@Resolver(IPeriodicReport)
export class PeriodicReportResolver {
  constructor(
    private readonly service: PeriodicReportService,
    private readonly files: FileService
  ) {}

  @Query(() => IPeriodicReport, {
    description: 'Read a periodic report by id.',
  })
  async periodicReport(
    @Loader(ReportLoader) reports: LoaderOf<ReportLoader>,
    @IdsAndViewArg() { id }: IdsAndView
  ): Promise<IPeriodicReport> {
    return await reports.load(id);
  }

  @Query(() => PeriodicReportListOutput, {
    description: 'List of periodic reports',
  })
  async periodicReports(
    @AnonSession() session: Session,
    @ListArg(PeriodicReportListInput) input: PeriodicReportListInput,
    @Loader(ReportLoader) loader: LoaderOf<ReportLoader>
  ): Promise<PeriodicReportListOutput> {
    // Only let admins do this for now.
    if (!session.roles.includes('global:Administrator')) {
      throw new UnauthorizedException();
    }
    const list = await this.service.list(session, input);
    loader.primeAll(list.items);
    return list;
  }

  @ResolveField(() => CalendarDate, {
    description: 'When this report is due',
  })
  due(@Parent() report: IPeriodicReport) {
    return report.end.plus({ months: 1 }).endOf('month');
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

  @ResolveField(() => SecuredDirectory)
  async otherFiles(
    @Parent() report: IPeriodicReport,
    @AnonSession() session: Session
  ): Promise<SecuredDirectory> {
    const { value: directoryId, ...rest } = report.otherFiles;
    if (!rest.canRead || !directoryId) {
      return rest;
    }

    return {
      ...rest,
      value: await this.files.getDirectory(directoryId, session),
    };
  }
}
