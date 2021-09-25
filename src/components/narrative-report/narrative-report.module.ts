import { Module } from '@nestjs/common';
import { PeriodicReportModule } from '../periodic-report/periodic-report.module';
import { NarrativeReportEngagementConnectionResolver } from './engagement-connection.resolver';
import { NarrativeReportResolver } from './narrative-report.resolver';

@Module({
  imports: [PeriodicReportModule],
  providers: [
    NarrativeReportResolver,
    NarrativeReportEngagementConnectionResolver,
  ],
})
export class NarrativeReportModule {}
