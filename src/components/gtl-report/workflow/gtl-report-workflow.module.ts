import { forwardRef, Module } from '@nestjs/common';
import { PeriodicReportModule } from '../../periodic-report/periodic-report.module';
import { ProjectModule } from '../../project/project.module';
import { UserModule } from '../../user/user.module';
import { GtlReportWorkflowEventLoader } from './gtl-report-workflow-event.loader';
import { GtlReportWorkflowFlowchart } from './gtl-report-workflow.flowchart';
import { GtlReportWorkflowEventGranter } from './gtl-report-workflow.granter';
import { GtlReportWorkflowRepository } from './gtl-report-workflow.repository';
import { GtlReportWorkflowService } from './gtl-report-workflow.service';
import * as handlers from './handlers';
import { GtlReportExecuteTransitionResolver } from './resolvers/gtl-report-execute-transition.resolver';
import { GtlReportTransitionsResolver } from './resolvers/gtl-report-transitions.resolver';
import { GtlReportWorkflowEventResolver } from './resolvers/gtl-report-workflow-event.resolver';
import { GtlReportWorkflowEventsResolver } from './resolvers/gtl-report-workflow-events.resolver';

@Module({
  imports: [
    forwardRef(() => UserModule),
    forwardRef(() => PeriodicReportModule),
    // For the status-change email's project read. Project reaches this module
    // through Engagement → PeriodicReport, so the reference is deferred.
    forwardRef(() => ProjectModule),
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
    ...Object.values(handlers),
  ],
  exports: [GtlReportWorkflowService],
})
export class GtlReportWorkflowModule {}
