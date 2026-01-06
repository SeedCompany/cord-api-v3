import { Field, InputType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { type ID, IdField } from '~/common';
import { CreateDefinedFileVersionInput } from '../../file/dto';

@InputType()
export abstract class UploadPeriodicReportInput {
  @IdField()
  readonly report: ID<'PeriodicReport'>;

  @Field({
    description: 'New version of the report file',
  })
  @Type(() => CreateDefinedFileVersionInput)
  @ValidateNested()
  readonly file: CreateDefinedFileVersionInput;
}
