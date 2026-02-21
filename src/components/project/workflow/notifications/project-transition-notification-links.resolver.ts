import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Loader, type LoaderOf } from '~/core/data-loader';
import { ProjectWorkflowEvent } from '../dto';
import { ProjectWorkflowEventLoader } from '../project-workflow-event.loader';
import { ProjectTransitionNotification } from './project-transition-notification.dto';

@Resolver(ProjectTransitionNotification)
export class ProjectTransitionNotificationLinksResolver {
  @ResolveField(() => ProjectWorkflowEvent)
  async workflowEvent(
    @Parent() { workflowEvent }: ProjectTransitionNotification,
    @Loader(ProjectWorkflowEventLoader)
    events: LoaderOf<ProjectWorkflowEventLoader>,
  ) {
    return await events.load(workflowEvent.id);
  }
}
