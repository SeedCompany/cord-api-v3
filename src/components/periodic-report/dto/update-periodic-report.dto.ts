import { Field, InputType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { CalendarDate, DateField, ID, IdField } from '../../../common';
import { CreateDefinedFileVersionInput } from '../../file';

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
  readonly receivedDate?: CalendarDate;

  @Field({
    description: 'Why this report is skipped',
    nullable: true,
  })
  readonly skippedReason?: string;
}
