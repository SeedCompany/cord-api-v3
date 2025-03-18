import { Module } from '@nestjs/common';
import { splitDb } from '~/core';
import { RenameReasonOptionMigration } from './migrations/rename.migration';
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
    splitDb(
      ProgressReportVarianceExplanationRepository,
      VarianceExplanationGelRepository,
    ),
    RenameReasonOptionMigration,
  ],
})
export class ProgressReportVarianceExplanationModule {}
