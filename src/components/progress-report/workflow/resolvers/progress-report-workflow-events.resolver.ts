import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { AnonSession, Session } from '~/common';
import { ProgressReport } from '../../dto';
import { ProgressReportWorkflowEvent as WorkflowEvent } from '../dto/workflow-event.dto';
import { ProgressReportWorkflowService } from '../progress-report-workflow.service';

@Resolver(ProgressReport)
export class ProgressReportWorkflowEventsResolver {
  constructor(private readonly service: ProgressReportWorkflowService) {}

  @ResolveField(() => [WorkflowEvent])
  async workflowEvents(
    @Parent() report: ProgressReport,
    @AnonSession() session: Session
  ): Promise<WorkflowEvent[]> {
    return await this.service.list(report, session);
  }
}
