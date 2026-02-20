import { forwardRef, Module } from '@nestjs/common';
import { splitDb } from '~/core/database';
import { NotificationModule } from '../../notifications';
import { UserModule } from '../../user/user.module';
import { ProjectModule } from '../project.module';
import { ProjectWorkflowNotificationHandler } from './handlers/project-workflow-notification.handler';
import { StepHistoryToWorkflowEventsMigration } from './migrations/step-history-to-workflow-events.migration';
import { ProjectTransitionRequiringFinancialApprovalNotificationResolver } from './notifications/project-transition-requiring-financial-approval-notification.resolver';
import { ProjectTransitionRequiringFinancialApprovalNotificationService } from './notifications/project-transition-requiring-financial-approval-notification.service';
import { ProjectTransitionRequiringFinancialApprovalNotificationStrategy } from './notifications/project-transition-requiring-financial-approval-notification.strategy';
import { ProjectTransitionViaMembershipNotificationResolver } from './notifications/project-transition-via-membership-notification.resolver';
import { ProjectTransitionViaMembershipNotificationService } from './notifications/project-transition-via-membership-notification.service';
import { ProjectTransitionViaMembershipNotificationStrategy } from './notifications/project-transition-via-membership-notification.strategy';
import { ProjectWorkflowEventLoader } from './project-workflow-event.loader';
import { ProjectWorkflowChannels } from './project-workflow.channels';
import { ProjectWorkflowFlowchart } from './project-workflow.flowchart';
import { ProjectWorkflowEventGranter } from './project-workflow.granter';
import { ProjectWorkflowNeo4jRepository } from './project-workflow.neo4j.repository';
import { ProjectWorkflowRepository } from './project-workflow.repository';
import { ProjectWorkflowService } from './project-workflow.service';
import { ProjectExecuteTransitionResolver } from './resolvers/project-execute-transition.resolver';
import { ProjectTransitionsResolver } from './resolvers/project-transitions.resolver';
import { ProjectWorkflowEventResolver } from './resolvers/project-workflow-event.resolver';
import { ProjectWorkflowEventsResolver } from './resolvers/project-workflow-events.resolver';
import { ProjectWorkflowMutationSubscriptionsResolver } from './resolvers/project-workflow-mutation-subscriptions.resolver';

@Module({
  imports: [
    forwardRef(() => UserModule),
    forwardRef(() => ProjectModule),
    forwardRef(() => NotificationModule),
  ],
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
    splitDb(ProjectWorkflowRepository, {
      neo4j: ProjectWorkflowNeo4jRepository,
    }),
    ProjectWorkflowFlowchart,
    ProjectWorkflowNotificationHandler,
    StepHistoryToWorkflowEventsMigration,
    ProjectTransitionViaMembershipNotificationResolver,
    ProjectTransitionViaMembershipNotificationStrategy,
    ProjectTransitionViaMembershipNotificationService,
    ProjectTransitionRequiringFinancialApprovalNotificationResolver,
    ProjectTransitionRequiringFinancialApprovalNotificationStrategy,
    ProjectTransitionRequiringFinancialApprovalNotificationService,
  ],
  exports: [ProjectWorkflowService],
})
export class ProjectWorkflowModule {}
