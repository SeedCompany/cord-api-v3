import { forwardRef, Module } from '@nestjs/common';
import { EngagementModule } from '../engagement/engagement.module';
import { PeriodicReportModule } from '../periodic-report/periodic-report.module';
import { GtlGoalLoader } from './goals/gtl-goal.loader';
import { GtlGoalRepository } from './goals/gtl-goal.repository';
import { GtlGoalService } from './goals/gtl-goal.service';
import { SyncGtlReportToEngagementDateRange } from './handlers/sync-gtl-report-to-engagement.handler';
import { GtlReportPracticumRepository } from './practicums/gtl-report-practicum.repository';
import { GtlReportPracticumService } from './practicums/gtl-report-practicum.service';
import { GtlProgressExplanationRepository } from './progress-explanation/gtl-progress-explanation.repository';
import { GtlProgressExplanationService } from './progress-explanation/gtl-progress-explanation.service';
import { GtlReportCommunityImpactRepository } from './prose/gtl-report-community-impact.repository';
import { GtlReportCommunityImpactService } from './prose/gtl-report-community-impact.service';
import { GtlReportHighlightRepository } from './prose/gtl-report-highlight.repository';
import { GtlReportHighlightService } from './prose/gtl-report-highlight.service';
import {
  GtlGoalEngagementResolver,
  GtlGoalProgressResolver,
  GtlGoalResolver,
  GtlReportGoalsResolver,
} from './resolvers/gtl-goal.resolver';
import { GtlProgressExplanationResolver } from './resolvers/gtl-progress-explanation.resolver';
import { GtlReportEngagementConnectionResolver } from './resolvers/gtl-report-engagement-connection.resolver';
import { GtlReportParentResolver } from './resolvers/gtl-report-parent.resolver';
import {
  GtlReportPracticumResolver,
  GtlReportPracticumsResolver,
} from './resolvers/gtl-report-practicum.resolver';
import { GtlReportProseResolver } from './resolvers/gtl-report-prose.resolver';
import { GtlReportWorkflowModule } from './workflow/gtl-report-workflow.module';

/**
 * GTL (Global Translation Leader) quarterly reports.
 *
 * The report rows live on `periodic_reports` and are read and written through
 * the shared PeriodicReport stack, so this module adds only what is specific
 * to GTL: generating the reports from an Internship engagement's date range,
 * the engagement-facing GraphQL fields, the report's own workflow, the
 * leader's goals with their per-quarter progress, and the report's written
 * sections — Community Impact and Highlights (prompt responses), Practicum,
 * and the confidential Explanation of Progress.
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
    GtlReportCommunityImpactRepository,
    GtlReportCommunityImpactService,
    GtlReportHighlightRepository,
    GtlReportHighlightService,
    GtlReportProseResolver,
    GtlReportPracticumRepository,
    GtlReportPracticumService,
    GtlReportPracticumsResolver,
    GtlReportPracticumResolver,
    GtlProgressExplanationRepository,
    GtlProgressExplanationService,
    GtlProgressExplanationResolver,
  ],
  exports: [
    GtlGoalService,
    GtlReportCommunityImpactService,
    GtlReportHighlightService,
    GtlReportPracticumService,
    GtlProgressExplanationService,
  ],
})
export class GtlReportModule {}
