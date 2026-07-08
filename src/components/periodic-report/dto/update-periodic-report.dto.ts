import { Field, InputType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { type CalendarDate, DateField, type ID, IdField } from '~/common';
import { CreateDefinedFileVersion } from '../../file/dto';

@InputType()
export abstract class UpdatePeriodicReport {
  @IdField()
  readonly id: ID;

  @Field({
    description: 'New version of the report file',
    nullable: true,
  })
  @Type(() => CreateDefinedFileVersion)
  @ValidateNested()
  readonly reportFile?: CreateDefinedFileVersion;

  @Field({
    description: 'New version of the narrative file',
    nullable: true,
  })
  @Type(() => CreateDefinedFileVersion)
  @ValidateNested()
  readonly narrativeFile?: CreateDefinedFileVersion;

  @DateField({ nullable: true })
  readonly receivedDate?: CalendarDate | null;

  @DateField({ nullable: true })
  readonly narrativeReceivedDate?: CalendarDate | null;

  @Field(() => String, {
    description: 'Why this report is skipped',
    nullable: true,
  })
  readonly skippedReason?: string | null;
}
