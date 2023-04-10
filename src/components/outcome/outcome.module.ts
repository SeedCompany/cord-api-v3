import { Module } from '@nestjs/common';
import { OutcomeEngagementConnectionResolver } from './outcome-engagement-connection.resolver';
import { OutcomeProgressReportConnectionResolver } from './outcome-progress-report-connection.resolver';
import { OutcomeLoader } from './outcome.loader';
import { OutcomesHistoryRepository } from './outcomes-history.repository';
import { OutcomesHistoryResolver } from './outcomes-history.resolver';
import { OutcomesHistoryService } from './outcomes-history.service';
import { OutcomesRepository } from './outcomes.repository';
import { OutcomesResolver } from './outcomes.resolver';
import { OutcomesService } from './outomes.service';

@Module({
  providers: [
    OutcomesResolver,
    OutcomesHistoryResolver,
    OutcomeLoader,
    OutcomeProgressReportConnectionResolver,
    OutcomeEngagementConnectionResolver,
    OutcomesRepository,
    OutcomesService,
    OutcomesHistoryRepository,
    OutcomesHistoryService,
  ],
})
export class OutcomeModule {}
