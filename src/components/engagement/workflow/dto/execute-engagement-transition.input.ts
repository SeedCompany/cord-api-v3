import { InputType } from '@nestjs/graphql';
import { ID, IdField } from '~/common';
import { ExecuteTransitionInput } from '../../../workflow/dto';
import { EngagementStatus } from '../../dto';

@InputType()
export abstract class ExecuteEngagementTransitionInput extends ExecuteTransitionInput(
  EngagementStatus,
) {
  @IdField({
    description: 'The engagement ID to transition',
  })
  readonly engagement: ID;
}
