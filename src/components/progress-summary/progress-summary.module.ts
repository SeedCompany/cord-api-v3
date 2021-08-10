import { Module } from '@nestjs/common';
import { FileModule } from '../file/file.module';
import { PeriodicReportModule } from '../periodic-report/periodic-report.module';
import * as handlers from './handlers';
import { ProgressExtractor } from './progress-extractor.service';
import { ProgressReportConnectionResolver } from './progress-report-connection.resolver';
import { ProgressSummaryEngagementConnectionResolver } from './progress-summary-engagement-connection.resolver';
import { ProgressSummaryRepository } from './progress-summary.repository';
import { ProgressSummaryResolver } from './progress-summary.resolver';

@Module({
  imports: [PeriodicReportModule, FileModule],
  providers: [
    ProgressReportConnectionResolver,
    ProgressSummaryEngagementConnectionResolver,
    ProgressSummaryResolver,
    ProgressSummaryRepository,
    ProgressExtractor,
    ...Object.values(handlers),
  ],
})
export class ProgressSummaryModule {}
