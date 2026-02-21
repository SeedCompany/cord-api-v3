import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Loader, type LoaderOf } from '~/core/data-loader';
import { ProjectWorkflowEvent } from '../dto';
import { ProjectWorkflowEventLoader } from '../project-workflow-event.loader';
import { ProjectTransitionViaMembershipNotification as Notification } from './project-transition-via-membership-notification.dto';

@Resolver(Notification)
export class ProjectTransitionViaMembershipNotificationResolver {
  @ResolveField(() => ProjectWorkflowEvent)
  async workflowEvent(
    @Parent() { workflowEvent }: Notification,
    @Loader(ProjectWorkflowEventLoader)
    events: LoaderOf<ProjectWorkflowEventLoader>,
  ) {
    return await events.load(workflowEvent.id);
  }
}
