import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { IdField } from '../../../../common';
import { PlanChangeStatus } from './plan-change-status.enum';
import { PlanChangeType } from './plan-change-type.enum';
import { PlanChange } from './plan-change.dto';

@InputType()
export abstract class UpdatePlanChange {
  @IdField()
  readonly id: string;

  @Field(() => [PlanChangeType], { nullable: true })
  readonly types?: [PlanChangeType];

  @Field(() => String)
  readonly summary?: string;

  @Field(() => PlanChangeStatus)
  readonly status?: PlanChangeStatus;
}

@InputType()
export abstract class UpdatePlanChangeInput {
  @Field()
  @Type(() => UpdatePlanChange)
  @ValidateNested()
  readonly planChange: UpdatePlanChange;
}

@ObjectType()
export abstract class UpdatePlanChangeOutput {
  @Field()
  readonly planChange: PlanChange;
}
