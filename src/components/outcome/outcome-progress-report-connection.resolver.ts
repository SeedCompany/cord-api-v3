import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { ProgressReport } from '../progress-report/dto';
import { OutcomeList } from './dto/list-outcome.dto';
import { OutcomeHistoryList } from './dto/list-outcomes-history.dto';
import { OutcomesHistoryService } from './outcomes-history.service';
import { OutcomesService } from './outomes.service';

@Resolver(ProgressReport)
export class OutcomeProgressReportConnectionResolver {
  constructor(
    private readonly service: OutcomesService,
    private readonly outcomesHistoryService: OutcomesHistoryService,
  ) {}

  @ResolveField(() => OutcomeList, {
    description: 'List of outcomes belonging to an engagement',
  })
  async outcomes(@Parent() report: ProgressReport) {
    const temp = await this.outcomesHistoryService.listByReportId(report.id);
    return temp;
  }

  @ResolveField(() => OutcomeHistoryList, {
    description: 'List of outcomes history belonging to a report',
  })
  async outcomesHistory(@Parent() report: ProgressReport) {
    const temp = await this.outcomesHistoryService.listByReportId(report.id);
    return temp;
  }
}
