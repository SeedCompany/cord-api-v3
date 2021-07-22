import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { AnonSession, Session } from '../../common';
import { IEngagement } from '../engagement';
import { IProject } from './dto';
import { ProjectService } from './project.service';

@Resolver(IEngagement)
export class ProjectEngagementConnectionResolver {
  constructor(private readonly projects: ProjectService) {}

  @ResolveField(() => IProject)
  async project(
    @Parent() engagement: IEngagement,
    @AnonSession() session: Session
  ) {
    return await this.projects.readOne(engagement.project, session);
  }
}
