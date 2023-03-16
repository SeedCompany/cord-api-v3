import { Module } from '@nestjs/common';
import { OutcomeEngagementConnectionResolver } from './outcome-engagement-connection.resolver';
import { OutcomeProgressReportConnectionResolver } from './outcome-progress-report-connection.resolver';
import { OutcomeLoader } from './outcome.loader';
import { OutcomesHistoryResolver } from './outcomes-history.resolver';
import { OutcomesResolver } from './outcomes.resolver';

@Module({
  providers: [
    OutcomesResolver,
    OutcomesHistoryResolver,
    OutcomeLoader,
    OutcomeProgressReportConnectionResolver,
    OutcomeEngagementConnectionResolver,
  ],
})
export class OutcomeModule {}
