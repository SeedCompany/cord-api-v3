import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { CalendarDate } from '../../../common';
import { IPeriodicReport, PeriodicReport } from './periodic-report.dto';
import { ReportType } from './type.enum';

@InputType()
export class CreatePeriodicReport {
  @Field(() => ReportType)
  readonly type: ReportType;

  @Field(() => CalendarDate)
  readonly start: CalendarDate;

  @Field(() => CalendarDate)
  readonly end: CalendarDate;
}

@InputType()
export abstract class CreatePeriodicReportInput {
  @Field()
  @Type(() => CreatePeriodicReport)
  @ValidateNested()
  readonly periodicReport: CreatePeriodicReport;
}

@ObjectType()
export abstract class CreatePeriodicReportOutput {
  @Field(() => IPeriodicReport)
  readonly periodicReport: PeriodicReport;
}
