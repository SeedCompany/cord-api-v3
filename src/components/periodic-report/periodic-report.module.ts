import { forwardRef, Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { EngagementModule } from '../engagement/engagement.module';
import { FileModule } from '../file/file.module';
import { ProjectModule } from '../project/project.module';
import * as handlers from './handlers';
import * as migrations from './migrations';
import { PeriodicReportEngagementConnectionResolver } from './periodic-report-engagement-connection.resolver';
import { PeriodicReportParentResolver } from './periodic-report-parent.resolver';
import { PeriodicReportProjectConnectionResolver } from './periodic-report-project-connection.resolver';
import { PeriodicReportLoader } from './periodic-report.loader';
import { PeriodicReportRepository } from './periodic-report.repository';
import { PeriodicReportResolver } from './periodic-report.resolver';
import { PeriodicReportService } from './periodic-report.service';
import { ProgressReportParentResolver } from './progress-report-parent.resolver';
import { ProgressReportResolver } from './progress-report.resolver';

@Module({
  imports: [
    FileModule,
    forwardRef(() => AuthorizationModule),
    forwardRef(() => EngagementModule),
    forwardRef(() => ProjectModule),
  ],
  providers: [
    PeriodicReportService,
    PeriodicReportResolver,
    ProgressReportResolver,
    PeriodicReportProjectConnectionResolver,
    PeriodicReportEngagementConnectionResolver,
    PeriodicReportParentResolver,
    ProgressReportParentResolver,
    PeriodicReportRepository,
    PeriodicReportLoader,
    ...Object.values(handlers),
    ...Object.values(migrations),
  ],
  exports: [PeriodicReportService],
})
export class PeriodicReportModule {}
