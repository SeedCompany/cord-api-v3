import { Injectable } from '@nestjs/common';
import { WorkflowFlowchart } from '../../workflow/workflow.flowchart';
import { ProjectStep } from '../dto';
import { ProjectWorkflowEvent } from './dto';
import { Transitions } from './transitions';

@Injectable()
export class ProjectWorkflowFlowchart extends WorkflowFlowchart(
  ProjectStep,
  Transitions,
  ProjectWorkflowEvent,
) {}
