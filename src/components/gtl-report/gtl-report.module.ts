import { forwardRef, Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { EngagementModule } from '../engagement/engagement.module';
import { PeriodicReportModule } from '../periodic-report/periodic-report.module';
import { PostModule } from '../post/post.module';
import { GtlGoalDrizzleRepository } from './goals/gtl-goal.drizzle.repository';
import { GtlGoalService } from './goals/gtl-goal.service';
import {
  GtlGoalEngagementResolver,
  GtlGoalProgressResolver,
  GtlGoalResolver,
} from './gtl-goal.resolver';
import { GtlReportEngagementConnectionResolver } from './gtl-report-engagement-connection.resolver';
import { GtlReportPrayerResolver } from './gtl-report-prayer.resolver';
import { GtlReportProseResolver } from './gtl-report-prose.resolver';
import { GtlReportSectionsResolver } from './gtl-report-sections.resolver';
import { SyncGtlReportToEngagementDateRange } from './handlers/sync-gtl-report-to-engagement.handler';
import { GtlReportPracticumDrizzleRepository } from './practicums/gtl-report-practicum.drizzle.repository';
import { GtlReportPracticumResolver } from './practicums/gtl-report-practicum.resolver';
import { GtlReportPracticumService } from './practicums/gtl-report-practicum.service';
import { GtlProgressExplanationRepository } from './progress-explanation/gtl-progress-explanation.repository';
import { GtlProgressExplanationResolver } from './progress-explanation/gtl-progress-explanation.resolver';
import { GtlReportCommunityImpactDrizzleRepository } from './prose/gtl-report-community-impact.drizzle.repository';
import { GtlReportCommunityImpactService } from './prose/gtl-report-community-impact.service';
import { GtlReportWorkflowRepository } from './workflow/gtl-report-workflow.repository';
import { GtlReportWorkflowResolver } from './workflow/gtl-report-workflow.resolver';
import { GtlReportWorkflowService } from './workflow/gtl-report-workflow.service';

/**
 * GTL (Global Translation Leader) quarterly narrative reports.
 *
 * Postgres-only: no `splitDb`, no Neo4j or Gel repository. The report rows
 * themselves live on `periodic_reports` and are served by the shared
 * PeriodicReport stack, so this module contributes the GTL-specific generation
 * and the engagement-facing GraphQL surface.
 */
@Module({
  imports: [
    forwardRef(() => PeriodicReportModule),
    forwardRef(() => EngagementModule),
    forwardRef(() => AuthorizationModule),
    forwardRef(() => PostModule),
  ],
  providers: [
    GtlReportEngagementConnectionResolver,
    GtlReportSectionsResolver,
    // Registered bare — Postgres-only, no splitDb. @see components/audit
    GtlGoalDrizzleRepository,
    GtlGoalService,
    GtlGoalResolver,
    GtlGoalProgressResolver,
    GtlGoalEngagementResolver,
    GtlReportPracticumDrizzleRepository,
    GtlReportPracticumResolver,
    GtlReportPracticumService,
    GtlReportProseResolver,
    GtlReportCommunityImpactDrizzleRepository,
    GtlReportCommunityImpactService,
    GtlReportPrayerResolver,
    GtlProgressExplanationResolver,
    GtlProgressExplanationRepository,
    GtlReportWorkflowResolver,
    GtlReportWorkflowService,
    GtlReportWorkflowRepository,
    SyncGtlReportToEngagementDateRange,
  ],
})
export class GtlReportModule {}
