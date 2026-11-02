import { forwardRef, Module } from '@nestjs/common';
import { LanguageModule } from '../../language/language.module';
import { PeriodicReportModule } from '../../periodic-report/periodic-report.module';
import { ProjectModule } from '../../project/project.module';
import { UserModule } from '../../user/user.module';
import * as handlers from './handlers';
import { ProgressReportWorkflowEventLoader } from './progress-report-workflow-event.loader';
import { ProgressReportWorkflowFlowchart } from './progress-report-workflow.flowchart';
import { ProgressReportWorkflowEventGranter } from './progress-report-workflow.granter';
import { ProgressReportWorkflowRepository } from './progress-report-workflow.repository';
import { ProgressReportWorkflowService } from './progress-report-workflow.service';
import { ProgressReportExecuteTransitionResolver } from './resolvers/progress-report-execute-transition.resolver';
import { ProgressReportTransitionsResolver } from './resolvers/progress-report-transitions.resolver';
import { ProgressReportWorkflowEventResolver } from './resolvers/progress-report-workflow-event.resolver';
import { ProgressReportWorkflowEventsResolver } from './resolvers/progress-report-workflow-events.resolver';

@Module({
  imports: [
    UserModule,
    ProjectModule,
    LanguageModule,
    forwardRef(() => PeriodicReportModule),
  ],
  providers: [
    ProgressReportTransitionsResolver,
    ProgressReportExecuteTransitionResolver,
    ProgressReportWorkflowEventsResolver,
    ProgressReportWorkflowEventResolver,
    ProgressReportWorkflowEventLoader,
    ProgressReportWorkflowService,
    ProgressReportWorkflowEventGranter,
    ProgressReportWorkflowRepository,
    ProgressReportWorkflowFlowchart,
    ...Object.values(handlers),
  ],
})
export class ProgressReportWorkflowModule {}
