import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { CalendarDate, IdField } from '../../../../common';
import { CreateDefinedFileVersionInput } from '../../../file';
import { ProjectReport } from './project-report.dto';
import { PeriodType, ReportType } from './report';

@InputType()
export abstract class UpdateProjectReport {
  @IdField()
  readonly id: string;

  @Field(() => ReportType)
  readonly reportType: ReportType;

  @Field(() => PeriodType)
  readonly periodType: PeriodType;

  @Field({ nullable: true })
  readonly period?: CalendarDate;

  @Field({
    description: 'New version of the report',
    nullable: true,
  })
  @Type(() => CreateDefinedFileVersionInput)
  @ValidateNested()
  readonly reportFile?: CreateDefinedFileVersionInput;
}

@InputType()
export abstract class UpdateProjectReportInput {
  @Field()
  @Type(() => UpdateProjectReportInput)
  @ValidateNested()
  readonly projectReport: UpdateProjectReport;
}

@ObjectType()
export abstract class UpdateProjectReportOutput {
  @Field()
  readonly projectReport: ProjectReport;
}
