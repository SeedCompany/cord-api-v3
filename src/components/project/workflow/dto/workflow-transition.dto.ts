import { ObjectType } from '@nestjs/graphql';
import { WorkflowTransition } from '../../../workflow/dto';
import { ProjectStep } from '../../dto';

@ObjectType({
  description: WorkflowTransition.descriptionFor('project'),
})
export abstract class ProjectWorkflowTransition extends WorkflowTransition(
  ProjectStep,
) {}
