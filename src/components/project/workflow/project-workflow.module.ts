import { forwardRef, Module } from '@nestjs/common';
import { UserModule } from '../../user/user.module';
import { ProjectModule } from '../project.module';
import { ProjectWorkflowNotificationHandler } from './handlers/project-workflow-notification.handler';
import { ProjectWorkflowEventLoader } from './project-workflow-event.loader';
import { ProjectWorkflowChannels } from './project-workflow.channels';
import { ProjectWorkflowFlowchart } from './project-workflow.flowchart';
import { ProjectWorkflowEventGranter } from './project-workflow.granter';
import { ProjectWorkflowRepository } from './project-workflow.repository';
import { ProjectWorkflowService } from './project-workflow.service';
import { ProjectExecuteTransitionResolver } from './resolvers/project-execute-transition.resolver';
import { ProjectTransitionsResolver } from './resolvers/project-transitions.resolver';
import { ProjectWorkflowEventResolver } from './resolvers/project-workflow-event.resolver';
import { ProjectWorkflowEventsResolver } from './resolvers/project-workflow-events.resolver';
import { ProjectWorkflowMutationSubscriptionsResolver } from './resolvers/project-workflow-mutation-subscriptions.resolver';

@Module({
  imports: [forwardRef(() => UserModule), forwardRef(() => ProjectModule)],
  providers: [
    ProjectTransitionsResolver,
    ProjectExecuteTransitionResolver,
    ProjectWorkflowEventsResolver,
    ProjectWorkflowEventResolver,
    ProjectWorkflowMutationSubscriptionsResolver,
    ProjectWorkflowEventLoader,
    ProjectWorkflowService,
    ProjectWorkflowChannels,
    ProjectWorkflowEventGranter,
    ProjectWorkflowRepository,
    ProjectWorkflowFlowchart,
    ProjectWorkflowNotificationHandler,
  ],
  exports: [ProjectWorkflowService],
})
export class ProjectWorkflowModule {}
