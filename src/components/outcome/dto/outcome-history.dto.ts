import { Field, ObjectType } from '@nestjs/graphql';
import { IdOf, Resource } from '~/common';
import { RegisterResource } from '../../../core';
import { ProgressReport } from '../../progress-report/dto';
import { Outcome } from './outcome.dto';
import { OutcomeStatus } from './status.enum';

@ObjectType()
@RegisterResource()
export class OutcomeHistory extends Resource {
  outcome: IdOf<Outcome>;
  report: IdOf<ProgressReport>;

  @Field(() => OutcomeStatus)
  status: OutcomeStatus;
}
