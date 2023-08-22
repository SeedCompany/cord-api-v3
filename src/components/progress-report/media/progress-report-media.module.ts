import { Module } from '@nestjs/common';
import {
  ProgressReportMediaActionsResolver,
  ProgressReportMediaProgressReportConnectionResolver,
  ProgressReportMediaResolver,
} from './progress-report-media.resolver';
import { ProgressReportMediaService } from './progress-report-media.service';

@Module({
  providers: [
    ProgressReportMediaResolver,
    ProgressReportMediaProgressReportConnectionResolver,
    ProgressReportMediaActionsResolver,
    ProgressReportMediaService,
  ],
})
export class ProgressReportMediaModule {}
