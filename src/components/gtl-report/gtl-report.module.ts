import { forwardRef, Module } from '@nestjs/common';
import { EngagementModule } from '../engagement/engagement.module';
import { PeriodicReportModule } from '../periodic-report/periodic-report.module';
import { SyncGtlReportToEngagementDateRange } from './handlers/sync-gtl-report-to-engagement.handler';
import { GtlReportEngagementConnectionResolver } from './resolvers/gtl-report-engagement-connection.resolver';
import { GtlReportParentResolver } from './resolvers/gtl-report-parent.resolver';

/**
 * GTL (Global Translation Leader) quarterly reports.
 *
 * The report rows live on `periodic_reports` and are read and written through
 * the shared PeriodicReport stack, so this module adds only what is specific
 * to GTL: generating the reports from an Internship engagement's date range and
 * the engagement-facing GraphQL fields.
 */
@Module({
  imports: [
    forwardRef(() => PeriodicReportModule),
    forwardRef(() => EngagementModule),
  ],
  providers: [
    GtlReportEngagementConnectionResolver,
    GtlReportParentResolver,
    SyncGtlReportToEngagementDateRange,
  ],
})
export class GtlReportModule {}
