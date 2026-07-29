import { Module } from '@nestjs/common';
import { splitDb } from '~/core/database';
import { RenameReasonOptionMigration } from './migrations/rename.migration';
import { ProgressReportVarianceExplanationDrizzleRepository } from './variance-explanation.drizzle.repository';
import { VarianceExplanationGelRepository } from './variance-explanation.gel.repository';
import { ProgressReportVarianceExplanationLoader } from './variance-explanation.loader';
import { ProgressReportVarianceExplanationRepository } from './variance-explanation.repository';
import {
  ProgressReportVarianceExplanationReasonOptionsResolver,
  ProgressReportVarianceExplanationResolver,
} from './variance-explanation.resolver';
import { ProgressReportVarianceExplanationService } from './variance-explanation.service';

@Module({
  providers: [
    ProgressReportVarianceExplanationResolver,
    ProgressReportVarianceExplanationReasonOptionsResolver,
    ProgressReportVarianceExplanationLoader,
    ProgressReportVarianceExplanationService,
    splitDb(ProgressReportVarianceExplanationRepository, {
      gel: VarianceExplanationGelRepository,
      // migration-todo: drop the Neo4j path (and this splitDb) at Phase 7 cutover.
      // migration-todo: remove `as any` once splitDb types accept drizzle repos.
      postgres: ProgressReportVarianceExplanationDrizzleRepository as any,
    }),
    RenameReasonOptionMigration,
  ],
})
export class ProgressReportVarianceExplanationModule {}
