import { ID } from '~/common';
import { LoaderFactory, SessionAwareLoaderStrategy } from '~/core';
import { ProjectWorkflowEvent as WorkflowEvent } from './dto';
import { ProjectWorkflowService } from './project-workflow.service';

@LoaderFactory(() => WorkflowEvent)
export class ProjectWorkflowEventLoader extends SessionAwareLoaderStrategy<WorkflowEvent> {
  constructor(private readonly service: ProjectWorkflowService) {
    super();
  }

  async loadMany(ids: readonly ID[]) {
    return await this.service.readMany(ids, this.session);
  }
}
