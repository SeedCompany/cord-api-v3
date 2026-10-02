import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { GTLReport } from '../../dto';
import { GtlReportWorkflowEvent as WorkflowEvent } from '../dto';
import { GtlReportWorkflowService } from '../gtl-report-workflow.service';

@Resolver(GTLReport)
export class GtlReportWorkflowEventsResolver {
  constructor(private readonly service: GtlReportWorkflowService) {}

  @ResolveField(() => [WorkflowEvent], {
    description: 'The workflow history of this report, oldest first',
  })
  async workflowEvents(
    @Parent() report: GTLReport,
  ): Promise<readonly WorkflowEvent[]> {
    return await this.service.list(report);
  }
}
