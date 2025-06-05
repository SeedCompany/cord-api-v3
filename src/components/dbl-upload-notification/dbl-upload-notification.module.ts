import { forwardRef, Module } from '@nestjs/common';
import { splitDb } from '~/core';
import { LanguageModule } from '../language/language.module';
import { ProgressReportWorkflowGelRepository } from '../progress-report/workflow/progress-report-workflow.gel.repository';
import { ProgressReportWorkflowModule } from '../progress-report/workflow/progress-report-workflow.module';
import { ProgressReportWorkflowRepository } from '../progress-report/workflow/progress-report-workflow.repository';
import { UserModule } from '../user/user.module';
import * as handlers from './handlers';

@Module({
  imports: [
    UserModule,
    LanguageModule,
    forwardRef(() => ProgressReportWorkflowModule),
  ],
  providers: [
    splitDb(
      ProgressReportWorkflowRepository,
      ProgressReportWorkflowGelRepository,
    ),
    ...Object.values(handlers),
  ],
})
export class DBLUploadNotificationModule {}
