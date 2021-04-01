import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { CalendarDate, IdField } from '../../../common';
import { CreateDefinedFileVersionInput } from '../../file';
import { IPeriodicReport, PeriodicReport } from './periodic-report.dto';
import { ReportType } from './report-type.enum';

@InputType()
export abstract class UpdatePeriodicReport {
  @IdField()
  readonly id: string;

  @Field(() => ReportType)
  readonly type: ReportType;

  @Field()
  readonly start?: CalendarDate;

  @Field()
  readonly end?: CalendarDate;

  @Field({
    description: 'New version of the report',
    nullable: true,
  })
  @Type(() => CreateDefinedFileVersionInput)
  @ValidateNested()
  readonly reportFile?: CreateDefinedFileVersionInput;
}

@InputType()
export abstract class UpdatePeriodicReportInput {
  @Field()
  @Type(() => UpdatePeriodicReportInput)
  @ValidateNested()
  readonly periodicReport: UpdatePeriodicReport;
}

@ObjectType()
export abstract class UpdatePeriodicReportOutput {
  @Field(() => IPeriodicReport)
  readonly periodicReport: PeriodicReport;
}
