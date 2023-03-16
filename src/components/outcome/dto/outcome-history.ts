import { Field, ObjectType } from '@nestjs/graphql';
import { IdOf } from '~/common';
import { ProgressReport } from '../../progress-report/dto';
import { Outcome } from './outcome.dto';
import { OutcomeStatus } from './status.enum';

@ObjectType()
export class OutcomeHistory {
  outcome: IdOf<Outcome>;
  report: IdOf<ProgressReport>;

  @Field(() => OutcomeStatus)
  status: OutcomeStatus;
}
