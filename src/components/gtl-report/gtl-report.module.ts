import { forwardRef, Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { EngagementModule } from '../engagement/engagement.module';
import { PeriodicReportModule } from '../periodic-report/periodic-report.module';
import { GtlReportGoalDrizzleRepository } from './goals/gtl-report-goal.drizzle.repository';
import { GtlReportGoalService } from './goals/gtl-report-goal.service';
import { GtlReportEngagementConnectionResolver } from './gtl-report-engagement-connection.resolver';
import { GtlReportSectionsResolver } from './gtl-report-sections.resolver';
import { SyncGtlReportToEngagementDateRange } from './handlers/sync-gtl-report-to-engagement.handler';
import { GtlReportPracticumDrizzleRepository } from './practicums/gtl-report-practicum.drizzle.repository';
import { GtlReportPracticumService } from './practicums/gtl-report-practicum.service';

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
  ],
  providers: [
    GtlReportEngagementConnectionResolver,
    GtlReportSectionsResolver,
    // Registered bare — Postgres-only, no splitDb. @see components/audit
    GtlReportGoalDrizzleRepository,
    GtlReportGoalService,
    GtlReportPracticumDrizzleRepository,
    GtlReportPracticumService,
    SyncGtlReportToEngagementDateRange,
  ],
})
export class GtlReportModule {}
