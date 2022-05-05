import { Field, InputType } from '@nestjs/graphql';
import { Transform, Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { uniq } from 'lodash';
import { CalendarDate, DateField, ID, IdField } from '../../../common';
import { CreateDefinedFileVersionInput } from '../../file';
import { ProgressVarianceReason } from './progress-variance-reason.enum';

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

@InputType()
export abstract class UpdateProgressReportInput extends UpdatePeriodicReportInput {
  @Field({
    description: 'Reason why this report is behind or ahead or on time.',
    nullable: true,
  })
  readonly varianceExplanation?: string;

  @Field(() => [ProgressVarianceReason], { nullable: true })
  @Transform(({ value }) => uniq(value))
  readonly varianceReasons?: ProgressVarianceReason[];
}
