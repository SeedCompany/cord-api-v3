import { ID } from '~/common';
import { LoaderFactory, SessionAwareLoaderStrategy } from '~/core';
import { EngagementWorkflowEvent as WorkflowEvent } from './dto';
import { EngagementWorkflowService } from './engagement-workflow.service';

@LoaderFactory(() => WorkflowEvent)
export class EngagementWorkflowEventLoader extends SessionAwareLoaderStrategy<WorkflowEvent> {
  constructor(private readonly service: EngagementWorkflowService) {
    super();
  }

  async loadMany(ids: readonly ID[]) {
    return await this.service.readMany(ids, this.session);
  }
}
