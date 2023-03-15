import { Field, ObjectType } from '@nestjs/graphql';
import { DbLabel, ID, IdField } from '~/common';
import { OutcomeStatus } from './status.enum';

@ObjectType()
export class OutcomeHistory {
  @IdField()
  report: ID;

  @Field(() => OutcomeStatus)
  @DbLabel('OutcomeStatus')
  status: OutcomeStatus;
}
