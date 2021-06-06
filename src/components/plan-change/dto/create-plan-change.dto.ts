import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { ID, IdField } from '../../../common';
import { PlanChangeStatus } from './plan-change-status.enum';
import { PlanChangeType } from './plan-change-type.enum';
import { PlanChange } from './plan-change.dto';

@InputType()
export abstract class CreatePlanChange {
  @IdField({
    description: 'A project ID',
  })
  readonly projectId: ID;

  @Field(() => [PlanChangeType])
  readonly types: PlanChangeType[];

  @Field()
  readonly summary: string;

  @Field(() => PlanChangeStatus)
  readonly status: PlanChangeStatus = PlanChangeStatus.Pending;
}

@InputType()
export abstract class CreatePlanChangeInput {
  @Field()
  @Type(() => CreatePlanChange)
  @ValidateNested()
  readonly planChange: CreatePlanChange;
}

@ObjectType()
export abstract class CreatePlanChangeOutput {
  @Field(() => PlanChange)
  readonly planChange: PlanChange;
}
