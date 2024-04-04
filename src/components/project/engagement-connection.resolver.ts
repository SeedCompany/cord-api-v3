import { Info, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Fields, IsOnly, viewOfChangeset } from '~/common';
import { Loader, LoaderOf } from '~/core';
import { IEngagement } from '../engagement/dto';
import { IProject } from './dto';
import { ProjectLoader } from './project.loader';

@Resolver(IEngagement)
export class ProjectEngagementConnectionResolver {
  @ResolveField(() => IProject)
  async project(
    @Info(Fields, IsOnly(['id', 'type'])) onlyId: boolean,
    @Parent() engagement: IEngagement,
    @Loader(ProjectLoader) projects: LoaderOf<ProjectLoader>,
  ) {
    if (onlyId) {
      return {
        id: engagement.project.id,
        changeset: engagement.changeset,
        // Used in Project.resolveType to resolve the concrete type
        type: engagement.project.type,
      };
    }
    return await projects.load({
      id: engagement.project.id,
      view: viewOfChangeset(engagement.changeset),
    });
  }
}
