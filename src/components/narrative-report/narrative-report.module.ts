import { Module } from '@nestjs/common';
import { EngagementModule } from '../engagement/engagement.module';
import { FileModule } from '../file/file.module';
import { PeriodicReportModule } from '../periodic-report/periodic-report.module';
import { NarrativeReportEngagementConnectionResolver } from './engagement-connection.resolver';
import * as handlers from './handlers';
import { NarrativeReportRepository } from './narrative-report.repository';
import { NarrativeReportResolver } from './narrative-report.resolver';
import { NarrativeReportService } from './narrative-report.service';

@Module({
  imports: [PeriodicReportModule, FileModule, EngagementModule],
  providers: [
    NarrativeReportResolver,
    NarrativeReportEngagementConnectionResolver,
    NarrativeReportService,
    NarrativeReportRepository,
    ...Object.values(handlers),
  ],
})
export class NarrativeReportModule {}
