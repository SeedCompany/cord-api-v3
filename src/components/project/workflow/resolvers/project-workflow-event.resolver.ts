import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { mapSecuredValue } from '~/common';
import { Loader, type LoaderOf } from '~/core';
import { ActorLoader } from '../../../user/actor.loader';
import { SecuredActor } from '../../../user/dto';
import { ProjectWorkflowEvent as WorkflowEvent } from '../dto';

@Resolver(WorkflowEvent)
export class ProjectWorkflowEventResolver {
  @ResolveField(() => SecuredActor)
  async who(
    @Parent() event: WorkflowEvent,
    @Loader(ActorLoader) actors: LoaderOf<ActorLoader>,
  ): Promise<SecuredActor> {
    return await mapSecuredValue(event.who, ({ id }) => actors.load(id));
  }
}
