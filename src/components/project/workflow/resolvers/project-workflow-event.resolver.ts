import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { mapSecuredValue } from '~/common';
import { Loader, type LoaderOf } from '~/core/data-loader';
import { ActorLoader } from '../../../user/actor.loader';
import { SecuredActor } from '../../../user/dto';
import { IProject, type Project } from '../../dto';
import { ProjectLoader } from '../../project.loader';
import { ProjectWorkflowEvent as WorkflowEvent } from '../dto';

@Resolver(WorkflowEvent)
export class ProjectWorkflowEventResolver {
  @ResolveField(() => IProject)
  async project(
    @Parent() event: WorkflowEvent,
    @Loader(ProjectLoader) projects: LoaderOf<ProjectLoader>,
  ): Promise<Project> {
    return await projects.load({
      id: event.project.id,
      view: { active: true },
    });
  }

  @ResolveField(() => SecuredActor)
  async who(
    @Parent() event: WorkflowEvent,
    @Loader(ActorLoader) actors: LoaderOf<ActorLoader>,
  ): Promise<SecuredActor> {
    return await mapSecuredValue(event.who, ({ id }) => actors.load(id));
  }
}
