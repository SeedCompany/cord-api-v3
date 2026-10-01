import { Module } from '@nestjs/common';
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
    ProgressReportVarianceExplanationRepository,
  ],
})
export class ProgressReportVarianceExplanationModule {}
