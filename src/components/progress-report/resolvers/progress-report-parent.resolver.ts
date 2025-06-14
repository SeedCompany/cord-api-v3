import { Info, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Fields, IsOnlyId } from '~/common';
import { Loader, type LoaderOf } from '~/core';
import { EngagementLoader } from '../../engagement';
import { ProgressReport } from '../dto';

@Resolver(ProgressReport)
export class ProgressReportParentResolver {
  @ResolveField()
  async parent(
    @Info(Fields, IsOnlyId) onlyId: boolean,
    @Parent() report: ProgressReport,
    @Loader(EngagementLoader) engagements: LoaderOf<EngagementLoader>,
  ) {
    if (onlyId) {
      return { id: report.parent.properties.id };
    }
    return await engagements.load({
      id: report.parent.properties.id,
      view: { active: true },
    });
  }
}
