import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { type CalendarDate, DateField, type ID, IdField } from '~/common';
import { ToolUsage } from './tool-usage.dto';

@InputType()
export abstract class UpdateToolUsage {
  @IdField()
  readonly id: ID;

  @DateField({ nullable: true })
  readonly startDate?: CalendarDate | null;
}

@InputType()
export abstract class UpdateToolUsageInput {
  @Field()
  readonly usage: UpdateToolUsage;
}

@ObjectType()
export abstract class UpdateToolUsageOutput {
  @Field()
  readonly toolUsage: ToolUsage;
}
