import { forwardRef, Module } from '@nestjs/common';
import { PeriodicReportModule } from '../periodic-report/periodic-report.module';
import { ProgressReportExtraForPeriodicInterfaceRepository } from './progress-report-extra-for-periodic-interface.repository';
import { ProgressReportRepository } from './progress-report.repository';
import { ProgressReportService } from './progress-report.service';
import { ProgressReportEngagementConnectionResolver } from './resolvers/progress-report-engagement-connection.resolver';
import { ProgressReportParentResolver } from './resolvers/progress-report-parent.resolver';
import { ProgressReportResolver } from './resolvers/progress-report.resolver';

@Module({
  imports: [forwardRef(() => PeriodicReportModule)],
  providers: [
    ProgressReportResolver,
    ProgressReportParentResolver,
    ProgressReportEngagementConnectionResolver,
    ProgressReportService,
    ProgressReportRepository,
    ProgressReportExtraForPeriodicInterfaceRepository,
  ],
  exports: [ProgressReportExtraForPeriodicInterfaceRepository],
})
export class ProgressReportModule {}
