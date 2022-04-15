import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { session } from 'neo4j-driver';
import {
  AnonSession,
  CalendarDate,
  ListArg,
  LoggedInSession,
  Order,
  PaginationInput,
  Session,
  SortablePaginationInput,
  UnauthorizedException,
} from '../../common';
import { Loader, LoaderOf } from '../../core';
import { IdsAndView, IdsAndViewArg } from '../changeset/dto';
import { FileListInput, FileNodeLoader, FileNodeType, FileService, resolveDefinedFile, SecuredDirectory, SecuredFile } from '../file';
import {
  IPeriodicReport,
  PeriodicReport,
  PeriodicReportListInput,
  PeriodicReportListOutput,
  ProgressReport,
  ReportType,
  UpdatePeriodicReportInput,
  UploadPeriodicReportInput,
} from './dto';
import { SyncPeriodicReportsToProjectDateRange } from './handlers';
import { PeriodicReportLoader as ReportLoader } from './periodic-report.loader';
import { PeriodicReportService } from './periodic-report.service';

@Resolver(IPeriodicReport)
export class PeriodicReportResolver {
  constructor(private readonly service: PeriodicReportService, private readonly files: FileService) {}

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
    deprecationReason: 'Moved to progress-report resolver'
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
    description: 'Returns Pnp file for progress report. Otherwise returns first report file of directory',
    deprecationReason: "Use directory or progress report's pnp resolver instead",
  })
  async reportFile(
    @LoggedInSession() session: Session,
    @Parent() report: PeriodicReport,
    @Loader(FileNodeLoader) files: LoaderOf<FileNodeLoader>
  ): Promise<SecuredFile> {
    const {value: directoryId, ...rest} = report.directory;
    
    if (!rest.canRead || !directoryId) {
      return rest;
    }
    if(report.type === ReportType.Progress) {
      return {canRead: rest.canRead, canEdit: rest.canEdit, value: report.pnp.value ?  await this.files.getFile(report.pnp.value, session) : undefined};
    } else {
      const children = await this.files.listChildren(directoryId, { filter: {  type: FileNodeType.File }, order: Order.ASC, sort: 'name', count: 1, page: 1}, session);
      const item = children.items[0];
      const file = await this.files.getFile(item.id, session);
      return {
        ...rest,
        value: file,
      }
    }
  }

  @ResolveField(() => SecuredDirectory)
  async directory(
    @Parent() report: IPeriodicReport,
    @AnonSession() session: Session
  ): Promise<SecuredDirectory> {
    const { value: directoryId, ...rest } = report.directory;
    if(!rest.canRead || !directoryId) {
      return rest;
    }
    console.log("getting directory")
    console.log(directoryId)
    return {
      ...rest,
      value: await this.files.getDirectory(directoryId, session),
    }
  }
}
