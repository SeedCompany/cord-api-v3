import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { CalendarDate, ListArg, UnauthorizedException } from '~/common';
import { Loader, type LoaderOf } from '~/core';
import { Identity } from '~/core/authentication';
import { type IdsAndView, IdsAndViewArg } from '../changeset/dto';
import { FileNodeLoader, resolveDefinedFile } from '../file';
import { SecuredFile } from '../file/dto';
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
    private readonly identity: Identity,
    private readonly service: PeriodicReportService,
  ) {}

  @Query(() => IPeriodicReport, {
    description: 'Read a periodic report by id.',
  })
  async periodicReport(
    @Loader(ReportLoader) reports: LoaderOf<ReportLoader>,
    @IdsAndViewArg() { id }: IdsAndView,
  ): Promise<IPeriodicReport> {
    return await reports.load(id);
  }

  @Query(() => PeriodicReportListOutput, {
    description: 'List of periodic reports',
  })
  async periodicReports(
    @ListArg(PeriodicReportListInput) input: PeriodicReportListInput,
    @Loader(ReportLoader) loader: LoaderOf<ReportLoader>,
  ): Promise<PeriodicReportListOutput> {
    // Only let admins do this for now, since it spans across projects,
    // and the db query may not be filtering correctly.
    // TODO update list query to filter by auth
    if (!this.identity.isAdmin) {
      throw new UnauthorizedException();
    }

    const list = await this.service.list(input);
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
    @Args('input')
    { reportId: id, file: reportFile }: UploadPeriodicReportInput,
  ): Promise<IPeriodicReport> {
    return await this.service.update({ id, reportFile });
  }

  @Mutation(() => IPeriodicReport, {
    description: 'Update a report',
  })
  async updatePeriodicReport(
    @Args('input') input: UpdatePeriodicReportInput,
  ): Promise<IPeriodicReport> {
    return await this.service.update(input);
  }

  @ResolveField(() => SecuredFile)
  async reportFile(
    @Parent() report: IPeriodicReport,
    @Loader(FileNodeLoader) files: LoaderOf<FileNodeLoader>,
  ): Promise<SecuredFile> {
    return await resolveDefinedFile(files, report.reportFile);
  }
}
