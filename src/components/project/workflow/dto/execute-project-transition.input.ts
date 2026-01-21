import { InputType } from '@nestjs/graphql';
import { type ID, IdField } from '~/common';
import { ExecuteTransition } from '../../../workflow/dto';
import { ProjectStep } from '../../dto';

@InputType()
export abstract class ExecuteProjectTransition extends ExecuteTransition(
  ProjectStep,
) {
  @IdField({
    description: 'The project ID to transition',
  })
  readonly project: ID;
}
