import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { ResourceLoader } from '~/core';
import { IPeriodicReport, type PeriodicReport } from '../periodic-report/dto';

@Resolver(IPeriodicReport)
export class PeriodicReportParentResolver {
  constructor(private readonly resources: ResourceLoader) {}

  @ResolveField()
  async parent(@Parent() report: PeriodicReport) {
    return await this.resources.loadByBaseNode(report.parent);
  }
}
