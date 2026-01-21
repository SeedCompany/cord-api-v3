import { Field, InputType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { type ID, IdField } from '~/common';
import { CreateDefinedFileVersion } from '../../file/dto';

@InputType()
export abstract class UploadPeriodicReportFile {
  @IdField()
  readonly report: ID<'PeriodicReport'>;

  @Field({
    description: 'New version of the report file',
  })
  @Type(() => CreateDefinedFileVersion)
  @ValidateNested()
  readonly file: CreateDefinedFileVersion;
}
