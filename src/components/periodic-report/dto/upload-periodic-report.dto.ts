import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { IdField } from '../../../common';
import { CreateDefinedFileVersionInput, SecuredFile } from '../../file';

@InputType()
export class UploadPeriodicReport {
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

@InputType()
export abstract class UploadPeriodicReportInput {
  @Field()
  @Type(() => UploadPeriodicReport)
  @ValidateNested()
  readonly input: UploadPeriodicReport;
}

@ObjectType()
export abstract class UploadPeriodicReportOutput {
  @Field(() => SecuredFile)
  readonly reportFile: SecuredFile;
}
