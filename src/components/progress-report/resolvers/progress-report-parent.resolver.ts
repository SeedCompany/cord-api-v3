import { Info, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Fields, type ID, IsOnlyId } from '~/common';
import { Loader, type LoaderOf } from '~/core/data-loader';
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
    // A progress report's parent is always a language engagement.
    const id = report.parent.id as ID<'LanguageEngagement'>;
    if (onlyId) {
      return { id };
    }
    return await engagements.load({
      id,
      view: { active: true },
    });
  }
}
