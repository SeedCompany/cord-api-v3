import { Info, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Fields, IsOnlyId } from '~/common';
import { Loader, type LoaderOf } from '~/core/data-loader';
import { EngagementLoader } from '../../engagement';
import { GTLReport } from '../dto';

/**
 * Resolves `GTLReport.parent` through the engagement DataLoader instead of the
 * generic `PeriodicReportParentResolver`, so a page of reports costs one
 * engagement query and an `{ id }`-only selection costs none. Same shape as
 * `ProgressReportParentResolver`.
 */
@Resolver(GTLReport)
export class GtlReportParentResolver {
  @ResolveField()
  async parent(
    @Info(Fields, IsOnlyId) onlyId: boolean,
    @Parent() report: GTLReport,
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
