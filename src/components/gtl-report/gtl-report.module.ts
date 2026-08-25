import { forwardRef, Module } from '@nestjs/common';
import { EngagementModule } from '../engagement/engagement.module';
import { PeriodicReportModule } from '../periodic-report/periodic-report.module';
import { GtlReportEngagementConnectionResolver } from './gtl-report-engagement-connection.resolver';
import { SyncGtlReportToEngagementDateRange } from './handlers/sync-gtl-report-to-engagement.handler';

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
  ],
  providers: [
    GtlReportEngagementConnectionResolver,
    SyncGtlReportToEngagementDateRange,
  ],
})
export class GtlReportModule {}
