import { Module } from '@nestjs/common';
import { FileModule } from '../file/file.module';
import { PeriodicReportModule } from '../periodic-report/periodic-report.module';
import * as handlers from './handlers';
import { ProgressReportConnectionResolver } from './progress-report-connection.resolver';
import { ProgressSummaryExtractor } from './progress-summary.extractor';
import { ProgressSummaryLoader } from './progress-summary.loader';
import { ProgressSummaryRepository } from './progress-summary.repository';
import { ProgressSummaryResolver } from './progress-summary.resolver';

@Module({
  imports: [PeriodicReportModule, FileModule],
  providers: [
    ProgressReportConnectionResolver,
    ProgressSummaryResolver,
    ProgressSummaryLoader,
    ProgressSummaryRepository,
    ProgressSummaryExtractor,
    ...Object.values(handlers),
  ],
})
export class ProgressSummaryModule {}
