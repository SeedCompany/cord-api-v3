import { Module } from '@nestjs/common';
import { PeriodicReportModule } from '../periodic-report/periodic-report.module';
import * as handlers from './handlers';
import { ProgressReportConnectionResolver } from './progress-report-connection.resolver';
import { ProgressSummaryEngagementConnectionResolver } from './progress-summary-engagement-connection.resolver';
import { ProgressSummaryRepository } from './progress-summary.repository';

@Module({
  imports: [PeriodicReportModule],
  providers: [
    ProgressReportConnectionResolver,
    ProgressSummaryEngagementConnectionResolver,
    ProgressSummaryRepository,
    ...Object.values(handlers),
  ],
})
export class ProgressSummaryModule {}
