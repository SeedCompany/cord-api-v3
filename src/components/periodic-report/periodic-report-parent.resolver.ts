import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Resource } from '../../common';
import { Loader, LoaderOf, ResourceResolver } from '../../core';
import { EngagementLoader } from '../engagement';
import { IPeriodicReport, PeriodicReport } from '../periodic-report';
import { ProjectLoader } from '../project';

@Resolver(IPeriodicReport)
export class PeriodicReportParentResolver {
  constructor(private readonly resources: ResourceResolver) {}

  @ResolveField(() => Resource)
  async parent(
    @Parent() report: PeriodicReport,
    @Loader(ProjectLoader) projects: LoaderOf<ProjectLoader>,
    @Loader(EngagementLoader) engagements: LoaderOf<EngagementLoader>
  ) {
    // Currently, Periodic Reports can only be attached to a Project or Engagement
    const resource = await (report.parent.labels.includes('Project')
      ? projects
      : engagements
    ).load({
      id: report.parent.properties.id,
      view: { active: true },
    });

    const type = this.resources.resolveTypeByBaseNode(report.parent);
    return { __typename: type, ...resource };
  }
}
