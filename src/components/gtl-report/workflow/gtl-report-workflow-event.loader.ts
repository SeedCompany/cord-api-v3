import { type ID } from '~/common';
import { type DataLoaderStrategy, LoaderFactory } from '~/core/data-loader';
import { GtlReportWorkflowEvent as WorkflowEvent } from './dto';
import { GtlReportWorkflowService } from './gtl-report-workflow.service';

@LoaderFactory(() => WorkflowEvent)
export class GtlReportWorkflowEventLoader implements DataLoaderStrategy<
  WorkflowEvent,
  ID<WorkflowEvent>
> {
  constructor(private readonly service: GtlReportWorkflowService) {}

  async loadMany(ids: ReadonlyArray<ID<WorkflowEvent>>) {
    return await this.service.readMany(ids);
  }
}
