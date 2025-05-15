import { Query, Resolver } from '@nestjs/graphql';
import { ListArg } from '~/common';
import { Loader, type LoaderOf } from '~/core';
import { PeriodicReportLoader as ReportLoader } from '../../periodic-report';
import {
  ProgressReport,
  ProgressReportList,
  ProgressReportListInput,
} from '../dto';
import { ProgressReportService } from '../progress-report.service';

@Resolver(ProgressReport)
export class ProgressReportResolver {
  constructor(private readonly service: ProgressReportService) {}

  @Query(() => ProgressReportList, {
    description: 'List of progress reports',
  })
  async progressReports(
    @ListArg(ProgressReportListInput) input: ProgressReportListInput,
    @Loader(ReportLoader) loader: LoaderOf<ReportLoader>,
  ): Promise<ProgressReportList> {
    const list = await this.service.list(input);
    loader.primeAll(list.items);
    return list;
  }
}
