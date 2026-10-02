import { forwardRef, Module } from '@nestjs/common';
import { PeriodicReportModule } from '../../periodic-report/periodic-report.module';
import { UserModule } from '../../user/user.module';
import { GtlReportWorkflowEventLoader } from './gtl-report-workflow-event.loader';
import { GtlReportWorkflowFlowchart } from './gtl-report-workflow.flowchart';
import { GtlReportWorkflowEventGranter } from './gtl-report-workflow.granter';
import { GtlReportWorkflowRepository } from './gtl-report-workflow.repository';
import { GtlReportWorkflowService } from './gtl-report-workflow.service';
import { GtlReportExecuteTransitionResolver } from './resolvers/gtl-report-execute-transition.resolver';
import { GtlReportTransitionsResolver } from './resolvers/gtl-report-transitions.resolver';
import { GtlReportWorkflowEventResolver } from './resolvers/gtl-report-workflow-event.resolver';
import { GtlReportWorkflowEventsResolver } from './resolvers/gtl-report-workflow-events.resolver';

@Module({
  imports: [
    forwardRef(() => UserModule),
    forwardRef(() => PeriodicReportModule),
  ],
  providers: [
    GtlReportTransitionsResolver,
    GtlReportExecuteTransitionResolver,
    GtlReportWorkflowEventsResolver,
    GtlReportWorkflowEventResolver,
    GtlReportWorkflowEventLoader,
    GtlReportWorkflowService,
    GtlReportWorkflowEventGranter,
    GtlReportWorkflowRepository,
    GtlReportWorkflowFlowchart,
  ],
  exports: [GtlReportWorkflowService],
})
export class GtlReportWorkflowModule {}
