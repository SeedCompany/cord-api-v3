import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Resource } from '../../common';
import { Loader, LoaderOf } from '../../core';
import { EngagementLoader } from '../engagement';
import { IPeriodicReport, PeriodicReport } from '../periodic-report';
import { ProjectLoader } from '../project';

@Resolver(IPeriodicReport)
export class PeriodicReportParentResolver {
  @ResolveField(() => Resource)
  async parent(
    @Parent() report: PeriodicReport,
    @Loader(ProjectLoader) projects: LoaderOf<ProjectLoader>,
    @Loader(EngagementLoader) engagements: LoaderOf<EngagementLoader>
  ) {
    // Currently Periodic Reports can only be attached to a Project or Engagement
    return await (report.parent.labels.includes('Project')
      ? projects
      : engagements
    ).load({
      id: report.parent.properties.id,
      view: { active: true },
    });
  }
}
