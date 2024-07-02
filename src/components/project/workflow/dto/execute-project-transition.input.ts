import { InputType } from '@nestjs/graphql';
import { ID, IdField } from '~/common';
import { ExecuteTransitionInput } from '../../../workflow/dto';
import { ProjectStep } from '../../dto';

@InputType()
export abstract class ExecuteProjectTransitionInput extends ExecuteTransitionInput(
  ProjectStep,
) {
  @IdField({
    description: 'The project ID to transition',
  })
  readonly project: ID;
}
