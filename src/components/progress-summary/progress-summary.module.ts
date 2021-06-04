import { Module } from '@nestjs/common';
import * as handlers from './handlers';
import { ProgressReportConnectionResolver } from './progress-report-connection.resolver';
import { ProgressSummaryRepository } from './progress-summary.repository';

@Module({
  providers: [
    ProgressReportConnectionResolver,
    ProgressSummaryRepository,
    ...Object.values(handlers),
  ],
})
export class ProgressSummaryModule {}
