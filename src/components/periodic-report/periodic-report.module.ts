import { forwardRef, Module } from '@nestjs/common';
import { DatabaseModule } from '../../core/database/database.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { EngagementModule } from '../engagement/engagement.module';
import { FileModule } from '../file/file.module';
import { ProgressExtractor } from '../progress-summary/progress-extractor.service';
import { ProgressSummaryRepository } from '../progress-summary/progress-summary.repository';
import { ProjectModule } from '../project/project.module';
import { UserModule } from '../user/user.module';
import * as handlers from './handlers';
import { PeriodicReportEngagementConnectionResolver } from './periodic-report-engagement-connection.resolver';
import { PeriodicReportProjectConnectionResolver } from './periodic-report-project-connection.resolver';
import { PeriodicReportRepository } from './periodic-report.repository';
import { PeriodicReportResolver } from './periodic-report.resolver';
import { PeriodicReportService } from './periodic-report.service';

@Module({
  imports: [
    FileModule,
    forwardRef(() => UserModule),
    forwardRef(() => AuthorizationModule),
    forwardRef(() => EngagementModule),
    forwardRef(() => ProjectModule),
    DatabaseModule, // Remove after periodic report migration
  ],
  providers: [
    PeriodicReportService,
    PeriodicReportResolver,
    PeriodicReportProjectConnectionResolver,
    PeriodicReportEngagementConnectionResolver,
    PeriodicReportRepository,
    ProgressExtractor, // Remove after periodic report migration
    ProgressSummaryRepository, // Remove after periodic report migration
    ...Object.values(handlers),
  ],
  exports: [PeriodicReportService, PeriodicReportRepository],
})
export class PeriodicReportModule {}
