import { Field, InputType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { ID, IdField } from '../../../common';
import { CreateDefinedFileVersionInput } from '../../file';

@InputType()
export abstract class UploadPeriodicReportInput {
  @IdField()
  readonly reportId: ID;

  @Field({
    description: 'New version of the report file',
    deprecationReason:
      'Periodic report now uses directory for multiple files upload.',
  })
  @Type(() => CreateDefinedFileVersionInput)
  @ValidateNested()
  readonly file: CreateDefinedFileVersionInput;
}
