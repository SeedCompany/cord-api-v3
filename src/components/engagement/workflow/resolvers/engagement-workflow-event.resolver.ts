import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { mapSecuredValue } from '~/common';
import { Loader, LoaderOf } from '~/core';
import { ActorLoader } from '../../../user/actor.loader';
import { SecuredActor } from '../../../user/dto';
import { EngagementWorkflowEvent as WorkflowEvent } from '../dto';

@Resolver(WorkflowEvent)
export class EngagementWorkflowEventResolver {
  @ResolveField(() => SecuredActor)
  async who(
    @Parent() event: WorkflowEvent,
    @Loader(ActorLoader) actors: LoaderOf<ActorLoader>,
  ): Promise<SecuredActor> {
    return await mapSecuredValue(event.who, ({ id }) => actors.load(id));
  }
}
