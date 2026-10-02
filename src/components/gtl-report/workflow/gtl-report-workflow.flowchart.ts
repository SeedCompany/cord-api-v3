import { Injectable } from '@nestjs/common';
import { WorkflowFlowchart } from '../../workflow/workflow.flowchart';
import { GtlReportWorkflow } from './gtl-report-workflow';

@Injectable()
export class GtlReportWorkflowFlowchart extends WorkflowFlowchart(
  () => GtlReportWorkflow,
) {}
