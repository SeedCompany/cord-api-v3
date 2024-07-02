import { ObjectType } from '@nestjs/graphql';
import { WorkflowTransition } from '../../../workflow/dto';
import { EngagementStatus } from '../../dto';

@ObjectType('EngagementWorkflowTransition', {
  description: WorkflowTransition.descriptionFor('engagement'),
})
export abstract class EngagementWorkflowTransition extends WorkflowTransition(
  EngagementStatus,
) {}
