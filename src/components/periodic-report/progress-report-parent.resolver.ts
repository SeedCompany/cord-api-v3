import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Loader, LoaderOf } from '../../core';
import { Engagement, EngagementLoader } from '../engagement';
import { LanguageEngagement } from '../engagement/dto';
import { ProgressReport } from '../periodic-report';

@Resolver(ProgressReport)
export class ProgressReportParentResolver {
  @ResolveField(() => LanguageEngagement)
  async parent(
    @Parent() report: ProgressReport,
    @Loader(EngagementLoader) engagements: LoaderOf<EngagementLoader>
  ): Promise<Engagement> {
    return await engagements.load({
      id: report.parent.properties.id,
      view: { active: true },
    });
  }
}
