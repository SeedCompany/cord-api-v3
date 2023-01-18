import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { mapSecuredValue } from '~/common';
import { Loader, LoaderOf } from '~/core';
import { SecuredUser, UserLoader } from '../../../user';
import { ProgressReportWorkflowEvent as WorkflowEvent } from '../dto/workflow-event.dto';

@Resolver(WorkflowEvent)
export class ProgressReportWorkflowEventResolver {
  @ResolveField(() => SecuredUser)
  async who(
    @Parent() event: WorkflowEvent,
    @Loader(UserLoader) users: LoaderOf<UserLoader>
  ): Promise<SecuredUser> {
    return await mapSecuredValue(event.who, (id) => users.load(id));
  }
}
