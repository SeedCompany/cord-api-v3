import { Field, InputType } from '@nestjs/graphql';
import { ID, IdField } from '~/common';
import { OutcomeStatus } from './status.enum';

@InputType({
  isAbstract: true,
})
export class UpdateOutcomeInput {
  @IdField()
  id: ID;

  @Field()
  description?: string;

  @Field(() => OutcomeStatus)
  status?: OutcomeStatus;

  @Field()
  report?: ID;
}
