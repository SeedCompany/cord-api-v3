import { Module } from '@nestjs/common';
import { ProgressReportConnectionResolver } from './progress-report-connection.resolver';

@Module({
  providers: [ProgressReportConnectionResolver],
})
export class ProgressSummaryModule {}
