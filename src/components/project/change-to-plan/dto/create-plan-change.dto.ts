import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';
import { Transform, Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { uniq } from 'lodash';
import { DateTime } from 'luxon';
import {
  CalendarDate,
  DateField,
  DateTimeField,
  IdField,
  IsId,
  NameField,
  Sensitivity,
} from '../../../../common';
import { PlanChange } from './plan-change.dto';
import { PlanChangeStatus } from './plan-change-status.enum';
import { PlanChangeType } from './plan-change-type.enum';

@InputType()
export abstract class CreatePlanChange {
  @Field(() => [PlanChangeType])
  readonly types: PlanChangeType[];

  @Field()
  readonly summary: string;

  @Field(() => PlanChangeStatus)
  readonly status: PlanChangeStatus;
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
