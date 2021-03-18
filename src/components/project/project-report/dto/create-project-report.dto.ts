import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { CalendarDate, IdField } from '../../../../common';
import { CreateDefinedFileVersionInput } from '../../../file';
import { ProjectReport } from './project-report.dto';
import { PeriodType, ReportType } from './report';

@InputType()
export class CreateProjectReport {
  @IdField({
    description: 'A project ID',
  })
  readonly projectId: string;

  @Field(() => ReportType)
  readonly reportType: ReportType;

  @Field(() => PeriodType)
  readonly periodType: PeriodType;

  @Field(() => CalendarDate, { nullable: true })
  readonly period?: CalendarDate;

  @Field({
    description: 'Initial version of the report file',
    nullable: true,
  })
  @Type(() => CreateDefinedFileVersionInput)
  @ValidateNested()
  readonly reportFile?: CreateDefinedFileVersionInput;
}

@InputType()
export abstract class CreateProjectReportInput {
  @Field()
  @Type(() => CreateProjectReport)
  @ValidateNested()
  readonly projectReport: CreateProjectReport;
}

@ObjectType()
export abstract class CreateProjectReportOutput {
  @Field()
  readonly projectReport: ProjectReport;
}
