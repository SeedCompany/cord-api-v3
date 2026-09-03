import { Module } from '@nestjs/common';
import { splitDb } from '~/core/database';
import { FileModule } from '../file/file.module';
import { PeriodicReportModule } from '../periodic-report/periodic-report.module';
import * as handlers from './handlers';
import { ProgressReportConnectionResolver } from './progress-report-connection.resolver';
import { ProgressSummaryDrizzleRepository } from './progress-summary.drizzle.repository';
import { ProgressSummaryExtractor } from './progress-summary.extractor';
import { ProgressSummaryGelRepository } from './progress-summary.gel.repository';
import { ProgressSummaryLoader } from './progress-summary.loader';
import { ProgressSummaryRepository } from './progress-summary.repository';
import { ProgressSummaryResolver } from './progress-summary.resolver';

@Module({
  imports: [PeriodicReportModule, FileModule],
  providers: [
    ProgressReportConnectionResolver,
    ProgressSummaryResolver,
    ProgressSummaryLoader,
    splitDb(ProgressSummaryRepository, {
      gel: ProgressSummaryGelRepository,
      // migration-todo: `as any` removed at Phase 7 cutover when splitDb
      // disappears with the Neo4j path.
      postgres: ProgressSummaryDrizzleRepository as any,
    }),
    ProgressSummaryExtractor,
    ...Object.values(handlers),
  ],
})
export class ProgressSummaryModule {}
