import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Loader, type LoaderOf } from '~/core/data-loader';
import { ProjectWorkflowEvent } from '../dto';
import { ProjectWorkflowEventLoader } from '../project-workflow-event.loader';
import { ProjectTransitionRequiringFinancialApprovalNotification as Notification } from './project-transition-requiring-financial-approval-notification.dto';

@Resolver(Notification)
export class ProjectTransitionRequiringFinancialApprovalNotificationResolver {
  @ResolveField(() => ProjectWorkflowEvent)
  async workflowEvent(
    @Parent() { workflowEvent }: Notification,
    @Loader(ProjectWorkflowEventLoader)
    events: LoaderOf<ProjectWorkflowEventLoader>,
  ) {
    return await events.load(workflowEvent.id);
  }
}
