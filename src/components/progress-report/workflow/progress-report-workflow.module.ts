import { Module } from '@nestjs/common';
import { ProgressReportWorkflowEventLoader } from './progress-report-workflow-event.loader';
import { ProgressReportWorkflowEventGranter } from './progress-report-workflow.granter';
import { ProgressReportWorkflowRepository } from './progress-report-workflow.repository';
import { ProgressReportWorkflowService } from './progress-report-workflow.service';
import { ProgressReportExecuteTransitionResolver } from './resolvers/progress-report-execute-transition.resolver';
import { ProgressReportTransitionsResolver } from './resolvers/progress-report-transitions.resolver';
import { ProgressReportWorkflowEventResolver } from './resolvers/progress-report-workflow-event.resolver';
import { ProgressReportWorkflowEventsResolver } from './resolvers/progress-report-workflow-events.resolver';

@Module({
  providers: [
    ProgressReportTransitionsResolver,
    ProgressReportExecuteTransitionResolver,
    ProgressReportWorkflowEventsResolver,
    ProgressReportWorkflowEventResolver,
    ProgressReportWorkflowEventLoader,
    ProgressReportWorkflowService,
    ProgressReportWorkflowEventGranter,
    ProgressReportWorkflowRepository,
  ],
})
export class ProgressReportWorkflowModule {}
