import { Field, InputType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { type CalendarDate, DateField, type ID, IdField } from '~/common';
import { CreateDefinedFileVersionInput } from '../../file/dto';

@InputType()
export abstract class UpdatePeriodicReportInput {
  @IdField()
  readonly id: ID;

  @Field({
    description: 'New version of the report file',
    nullable: true,
  })
  @Type(() => CreateDefinedFileVersionInput)
  @ValidateNested()
  readonly reportFile?: CreateDefinedFileVersionInput;

  @DateField({ nullable: true })
  readonly receivedDate?: CalendarDate | null;

  @Field(() => String, {
    description: 'Why this report is skipped',
    nullable: true,
  })
  readonly skippedReason?: string | null;
}
