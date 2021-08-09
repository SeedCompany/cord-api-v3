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
    description: "New version of the progress report's pnp file",
    nullable: true,
  })
  @Type(() => CreateDefinedFileVersionInput)
  @ValidateNested()
  readonly pnp?: CreateDefinedFileVersionInput;

  @DateField({ nullable: true })
  readonly receivedDate?: CalendarDate;
}
