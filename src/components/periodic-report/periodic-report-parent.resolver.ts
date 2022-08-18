import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Resource } from '../../common';
import { ResourceLoader } from '../../core';
import { IPeriodicReport, PeriodicReport } from '../periodic-report';

@Resolver(IPeriodicReport)
export class PeriodicReportParentResolver {
  constructor(private readonly resources: ResourceLoader) {}

  @ResolveField(() => Resource)
  async parent(@Parent() report: PeriodicReport) {
    return await this.resources.loadByBaseNode(report.parent);
  }
}
