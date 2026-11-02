import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Loader, type LoaderOf } from '~/core/data-loader';
import { IPeriodicReport, type PeriodicReport } from '../periodic-report/dto';
import { ProjectLoader } from '../project';

@Resolver(IPeriodicReport)
export class PeriodicReportParentResolver {
  // Financial and narrative reports hang off the project. Progress reports
  // resolve their own parent, the engagement, in ProgressReportParentResolver.
  @ResolveField()
  async parent(
    @Parent() report: PeriodicReport,
    @Loader(ProjectLoader) projects: LoaderOf<ProjectLoader>,
  ) {
    return await projects.load({
      id: report.project.id,
      view: { active: true },
    });
  }
}
