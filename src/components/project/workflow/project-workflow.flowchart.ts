import { Injectable } from '@nestjs/common';
import { WorkflowFlowchart } from '../../workflow/workflow.flowchart';
import { ProjectWorkflow } from './project-workflow';

@Injectable()
export class ProjectWorkflowFlowchart extends WorkflowFlowchart(
  ProjectWorkflow,
) {}
