import { forwardRef, Module } from '@nestjs/common';
import { EngagementModule } from '../engagement/engagement.module';
import { PeriodicReportModule } from '../periodic-report/periodic-report.module';
import { GtlGoalLoader } from './goals/gtl-goal.loader';
import { GtlGoalRepository } from './goals/gtl-goal.repository';
import { GtlGoalService } from './goals/gtl-goal.service';
import { SyncGtlReportToEngagementDateRange } from './handlers/sync-gtl-report-to-engagement.handler';
import {
  GtlGoalEngagementResolver,
  GtlGoalProgressResolver,
  GtlGoalResolver,
  GtlReportGoalsResolver,
} from './resolvers/gtl-goal.resolver';
import { GtlReportEngagementConnectionResolver } from './resolvers/gtl-report-engagement-connection.resolver';
import { GtlReportParentResolver } from './resolvers/gtl-report-parent.resolver';
import { GtlReportWorkflowModule } from './workflow/gtl-report-workflow.module';

/**
 * GTL (Global Translation Leader) quarterly reports.
 *
 * The report rows live on `periodic_reports` and are read and written through
 * the shared PeriodicReport stack, so this module adds only what is specific
 * to GTL: generating the reports from an Internship engagement's date range,
 * the engagement-facing GraphQL fields, the report's own workflow, and the
 * leader's goals with their per-quarter progress.
 */
@Module({
  imports: [
    forwardRef(() => PeriodicReportModule),
    forwardRef(() => EngagementModule),
    forwardRef(() => GtlReportWorkflowModule),
  ],
  providers: [
    GtlReportEngagementConnectionResolver,
    GtlReportParentResolver,
    SyncGtlReportToEngagementDateRange,
    GtlGoalRepository,
    GtlGoalService,
    GtlGoalLoader,
    GtlGoalEngagementResolver,
    GtlReportGoalsResolver,
    GtlGoalProgressResolver,
    GtlGoalResolver,
  ],
  exports: [GtlGoalService],
})
export class GtlReportModule {}
