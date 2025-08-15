import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { type CalendarDate, DateField, type ID, IdField } from '~/common';
import { ToolUsage } from './tool-usage.dto';

@InputType()
export abstract class UpdateToolUsage {
  @IdField()
  readonly id: ID<ToolUsage>;

  @DateField({ nullable: true })
  readonly startDate?: CalendarDate | null;
}

@ObjectType()
export abstract class UpdateToolUsageOutput {
  @Field()
  readonly toolUsage: ToolUsage;
}
