import { forwardRef, Module } from '@nestjs/common';
import { splitDb2 } from '~/core';
import { UserModule } from '../../user/user.module';
import { EngagementModule } from '../engagement.module';
import { EngagementWorkflowEventLoader } from './engagement-workflow-event.loader';
import { EngagementWorkflowFlowchart } from './engagement-workflow.flowchart';
import { EngagementWorkflowEventGranter } from './engagement-workflow.granter';
import { EngagementWorkflowNeo4jRepository } from './engagement-workflow.neo4j.repository';
import { EngagementWorkflowRepository } from './engagement-workflow.repository';
import { EngagementWorkflowService } from './engagement-workflow.service';
import { EngagementStatusHistoryToWorkflowEventsMigration } from './migrations/engagement-status-history-to-workflow-events.migration';
import { EngagementExecuteTransitionResolver } from './resolvers/engagement-execute-transition.resolver';
import { EngagementTransitionsResolver } from './resolvers/engagement-transitions.resolver';
import { EngagementWorkflowEventResolver } from './resolvers/engagement-workflow-event.resolver';
import { EngagementWorkflowEventsResolver } from './resolvers/engagement-workflow-events.resolver';

@Module({
  imports: [forwardRef(() => UserModule), forwardRef(() => EngagementModule)],
  providers: [
    EngagementTransitionsResolver,
    EngagementExecuteTransitionResolver,
    EngagementWorkflowEventsResolver,
    EngagementWorkflowEventResolver,
    EngagementWorkflowEventLoader,
    EngagementWorkflowService,
    EngagementWorkflowEventGranter,
    splitDb2(EngagementWorkflowRepository, {
      neo4j: EngagementWorkflowNeo4jRepository,
      edge: EngagementWorkflowRepository,
    }),
    EngagementWorkflowFlowchart,
    EngagementStatusHistoryToWorkflowEventsMigration,
  ],
  exports: [EngagementWorkflowService],
})
export class EngagementWorkflowModule {}
