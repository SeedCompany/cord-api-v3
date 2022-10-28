import { ID } from '~/common';
import { LoaderFactory, OrderedNestDataLoader } from '~/core';
import { ProgressReportWorkflowEvent as WorkflowEvent } from './dto/workflow-event.dto';
import { ProgressReportWorkflowService } from './progress-report-workflow.service';

@LoaderFactory(() => WorkflowEvent)
export class ProgressReportWorkflowEventLoader extends OrderedNestDataLoader<WorkflowEvent> {
  constructor(private readonly service: ProgressReportWorkflowService) {
    super();
  }

  async loadMany(ids: readonly ID[]) {
    return await this.service.readMany(ids, this.session);
  }
}
