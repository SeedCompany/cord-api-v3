import { type ID } from '~/common';
import { type DataLoaderStrategy, LoaderFactory } from '~/core/data-loader';
import { ProjectWorkflowEvent as WorkflowEvent } from './dto';
import { ProjectWorkflowService } from './project-workflow.service';

@LoaderFactory(() => WorkflowEvent)
export class ProjectWorkflowEventLoader implements DataLoaderStrategy<
  WorkflowEvent,
  ID<WorkflowEvent>
> {
  constructor(private readonly service: ProjectWorkflowService) {}

  async loadMany(ids: ReadonlyArray<ID<WorkflowEvent>>) {
    return await this.service.readMany(ids);
  }
}
