import { forwardRef, Module } from '@nestjs/common';
import { splitDb } from '~/core/database';
import { AuthorizationModule } from '../authorization/authorization.module';
import { EngagementModule } from '../engagement/engagement.module';
import { FileModule } from '../file/file.module';
import { ProgressReportModule } from '../progress-report/progress-report.module';
import { ProjectModule } from '../project/project.module';
import * as handlers from './handlers';
import { BackfillPeriodicReportNarrativeFileMigration } from './migrations/backfill-periodic-report-narrative-file.migration';
import { PeriodicReportParentResolver } from './periodic-report-parent.resolver';
import { PeriodicReportProjectConnectionResolver } from './periodic-report-project-connection.resolver';
import { PeriodicReportDrizzleRepository } from './periodic-report.drizzle.repository';
import { PeriodicReportLoader } from './periodic-report.loader';
import { PeriodicReportRepository } from './periodic-report.repository';
import { PeriodicReportResolver } from './periodic-report.resolver';
import { PeriodicReportService } from './periodic-report.service';

@Module({
  imports: [
    FileModule,
    forwardRef(() => AuthorizationModule),
    forwardRef(() => EngagementModule),
    forwardRef(() => ProjectModule),
    forwardRef(() => ProgressReportModule),
  ],
  providers: [
    PeriodicReportService,
    PeriodicReportResolver,
    PeriodicReportProjectConnectionResolver,
    PeriodicReportParentResolver,
    splitDb(PeriodicReportRepository, {
      // migration-todo: `as any` removed at Phase 7 cutover when splitDb
      // disappears with the Neo4j path.
      postgres: PeriodicReportDrizzleRepository as any,
    }),
    PeriodicReportLoader,
    BackfillPeriodicReportNarrativeFileMigration,
    ...Object.values(handlers),
  ],
  exports: [PeriodicReportService],
})
export class PeriodicReportModule {}
