import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { mapSecuredValue } from '~/common';
import { Loader, LoaderOf } from '~/core';
import { UserLoader } from '../../../user';
import { SecuredUser } from '../../../user/dto';
import { ProjectWorkflowEvent as WorkflowEvent } from '../dto';

@Resolver(WorkflowEvent)
export class ProjectWorkflowEventResolver {
  @ResolveField(() => SecuredUser)
  async who(
    @Parent() event: WorkflowEvent,
    @Loader(UserLoader) users: LoaderOf<UserLoader>,
  ): Promise<SecuredUser> {
    return await mapSecuredValue(event.who, ({ id }) => users.load(id));
  }
}
