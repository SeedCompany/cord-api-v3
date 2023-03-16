import { Field, InputType } from '@nestjs/graphql';
import { ID, IdField } from '~/common';
import { OutcomeStatus } from './status.enum';

@InputType()
export class UpdateOutcomeHistoryInput {
  @IdField()
  id: ID;

  @IdField()
  report: ID;

  @Field(() => OutcomeStatus)
  status?: OutcomeStatus;
}
