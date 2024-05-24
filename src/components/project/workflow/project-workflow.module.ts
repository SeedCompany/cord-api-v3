import { forwardRef, Module } from '@nestjs/common';
import { splitDb2 } from '~/core';
import { UserModule } from '../../user/user.module';
import { ProjectModule } from '../project.module';
import { ProjectWorkflowNotificationHandler } from './handlers/project-workflow-notification.handler';
import { StepHistoryToWorkflowEventsMigration } from './migrations/step-history-to-workflow-events.migration';
import { ProjectWorkflowEventLoader } from './project-workflow-event.loader';
import { ProjectWorkflowFlowchart } from './project-workflow.flowchart';
import { ProjectWorkflowEventGranter } from './project-workflow.granter';
import { ProjectWorkflowNeo4jRepository } from './project-workflow.neo4j.repository';
import { ProjectWorkflowRepository } from './project-workflow.repository';
import { ProjectWorkflowService } from './project-workflow.service';
import { ProjectExecuteTransitionResolver } from './resolvers/project-execute-transition.resolver';
import { ProjectTransitionsResolver } from './resolvers/project-transitions.resolver';
import { ProjectWorkflowEventResolver } from './resolvers/project-workflow-event.resolver';
import { ProjectWorkflowEventsResolver } from './resolvers/project-workflow-events.resolver';

@Module({
  imports: [forwardRef(() => UserModule), forwardRef(() => ProjectModule)],
  providers: [
    ProjectTransitionsResolver,
    ProjectExecuteTransitionResolver,
    ProjectWorkflowEventsResolver,
    ProjectWorkflowEventResolver,
    ProjectWorkflowEventLoader,
    ProjectWorkflowService,
    ProjectWorkflowEventGranter,
    splitDb2(ProjectWorkflowRepository, {
      neo4j: ProjectWorkflowNeo4jRepository,
      edge: ProjectWorkflowRepository,
    }),
    ProjectWorkflowFlowchart,
    ProjectWorkflowNotificationHandler,
    StepHistoryToWorkflowEventsMigration,
  ],
  exports: [ProjectWorkflowService],
})
export class ProjectWorkflowModule {}
