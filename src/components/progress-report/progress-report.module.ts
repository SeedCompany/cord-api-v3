import { forwardRef, Module } from '@nestjs/common';
import { PeriodicReportModule } from '../periodic-report/periodic-report.module';
import { ProgressReportHighlightsRepository } from './highlights/progress-report-highlights.repository';
import { ProgressReportHighlightsResolver } from './highlights/progress-report-highlights.resolver';
import { ProgressReportHighlightsService } from './highlights/progress-report-highlights.service';
import { AddProgressReportStatusMigration } from './migrations/AddStatus.migration';
import { ProgressReportExtraForPeriodicInterfaceRepository } from './progress-report-extra-for-periodic-interface.repository';
import { ProgressReportRepository } from './progress-report.repository';
import { ProgressReportService } from './progress-report.service';
import { ProgressReportEngagementConnectionResolver } from './resolvers/progress-report-engagement-connection.resolver';
import { ProgressReportParentResolver } from './resolvers/progress-report-parent.resolver';
import { ProgressReportResolver } from './resolvers/progress-report.resolver';
import { ProgressReportWorkflowModule } from './workflow/progress-report-workflow.module';

@Module({
  imports: [
    forwardRef(() => PeriodicReportModule),
    ProgressReportWorkflowModule,
  ],
  providers: [
    ProgressReportResolver,
    ProgressReportParentResolver,
    ProgressReportEngagementConnectionResolver,
    ProgressReportHighlightsResolver,
    ProgressReportHighlightsService,
    ProgressReportHighlightsRepository,
    ProgressReportService,
    ProgressReportRepository,
    ProgressReportExtraForPeriodicInterfaceRepository,
    AddProgressReportStatusMigration,
  ],
  exports: [ProgressReportExtraForPeriodicInterfaceRepository],
})
export class ProgressReportModule {}
