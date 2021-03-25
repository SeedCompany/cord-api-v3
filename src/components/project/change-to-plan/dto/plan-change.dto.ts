import { Field, ObjectType } from '@nestjs/graphql';
import { IdField } from '../../../../common';
import { PlanChangeStatus } from './plan-change-status.enum';
import { PlanChangeType } from './plan-change-type.enum';

@ObjectType()
export abstract class PlanChange {
  @IdField()
  readonly id: string;

  @Field(() => [PlanChangeType])
  readonly types: PlanChangeType[];

  @Field()
  readonly summary: string;

  @Field(() => PlanChangeStatus)
  readonly status: PlanChangeStatus;
}
