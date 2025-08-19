import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { type CalendarDate, DateField, type ID, IdField } from '~/common';
import { ToolUsage } from './tool-usage.dto';

@InputType()
export abstract class CreateToolUsage {
  @IdField({
    description: 'A resource ID',
  })
  readonly container: ID<'Resource'>;

  @IdField({
    description: 'A tool ID',
  })
  readonly tool: ID<'Tool'>;

  @DateField({ nullable: true })
  readonly startDate?: CalendarDate | null;
}

@ObjectType()
export abstract class CreateToolUsageOutput {
  @Field()
  readonly toolUsage: ToolUsage;
}
