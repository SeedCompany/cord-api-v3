import { type ID } from '~/common';
import { type DataLoaderStrategy, LoaderFactory } from '~/core/data-loader';
import { ProgressReportWorkflowEvent as WorkflowEvent } from './dto/workflow-event.dto';
import { ProgressReportWorkflowService } from './progress-report-workflow.service';

@LoaderFactory(() => WorkflowEvent)
export class ProgressReportWorkflowEventLoader
  implements DataLoaderStrategy<WorkflowEvent, ID<WorkflowEvent>>
{
  constructor(private readonly service: ProgressReportWorkflowService) {}

  async loadMany(ids: ReadonlyArray<ID<WorkflowEvent>>) {
    return await this.service.readMany(ids);
  }
}
