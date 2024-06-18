import { Injectable } from '@nestjs/common';
import { WorkflowFlowchart } from '../../workflow/workflow.flowchart';
import { EngagementWorkflow } from './engagement-workflow';

@Injectable()
export class EngagementWorkflowFlowchart extends WorkflowFlowchart(
  () => EngagementWorkflow,
) {}
