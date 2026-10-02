import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { mapSecuredValue } from '~/common';
import { Loader, type LoaderOf } from '~/core/data-loader';
import { ActorLoader } from '../../../user/actor.loader';
import { SecuredActor } from '../../../user/dto';
import { GtlReportWorkflowEvent as WorkflowEvent } from '../dto';

@Resolver(WorkflowEvent)
export class GtlReportWorkflowEventResolver {
  @ResolveField(() => SecuredActor)
  async who(
    @Parent() event: WorkflowEvent,
    @Loader(ActorLoader) actors: LoaderOf<ActorLoader>,
  ): Promise<SecuredActor> {
    return await mapSecuredValue(event.who, ({ id }) => actors.load(id));
  }
}
