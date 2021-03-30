import { Field, InputType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { IdField } from '../../../common';
import { CreateDefinedFileVersionInput } from '../../file';

@InputType()
export abstract class UploadPeriodicReportInput {
  @IdField()
  readonly reportId: string;

  @Field({
    description: 'Initial version of the report file',
    nullable: true,
  })
  @Type(() => CreateDefinedFileVersionInput)
  @ValidateNested()
  readonly file: CreateDefinedFileVersionInput;
}
