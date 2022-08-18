import { Info, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Fields, IsOnlyId, viewOfChangeset } from '../../common';
import { Loader, LoaderOf } from '../../core';
import { IEngagement } from '../engagement';
import { IProject, ProjectType } from './dto';
import { ProjectLoader } from './project.loader';

@Resolver(IEngagement)
export class ProjectEngagementConnectionResolver {
  @ResolveField(() => IProject)
  async project(
    @Info(Fields, IsOnlyId) onlyId: boolean,
    @Parent() engagement: IEngagement,
    @Loader(ProjectLoader) projects: LoaderOf<ProjectLoader>
  ) {
    if (onlyId) {
      return {
        id: engagement.project,
        changeset: engagement.changeset,
        // Used in Project.resolveType to resolve the concrete type
        type:
          engagement.__typename === 'LanguageEngagement'
            ? ProjectType.Translation
            : engagement.__typename === 'InternshipEngagement'
            ? ProjectType.Internship
            : ProjectType.Publication,
      };
    }
    return await projects.load({
      id: engagement.project,
      view: viewOfChangeset(engagement.changeset),
    });
  }
}
