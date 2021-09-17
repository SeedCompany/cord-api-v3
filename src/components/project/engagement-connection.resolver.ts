import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { viewOfChangeset } from '../../common';
import { Loader, LoaderOf } from '../../core';
import { IEngagement } from '../engagement';
import { IProject } from './dto';
import { ProjectLoader } from './project.loader';

@Resolver(IEngagement)
export class ProjectEngagementConnectionResolver {
  @ResolveField(() => IProject)
  async project(
    @Parent() engagement: IEngagement,
    @Loader(IProject) projects: LoaderOf<ProjectLoader>
  ) {
    return await projects.load({
      id: engagement.project,
      view: viewOfChangeset(engagement.changeset),
    });
  }
}
