import { Field, ID as IDType, InputType, ObjectType } from '@nestjs/graphql';
import { Transform, Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { uniq } from 'lodash';
import { DateTime } from 'luxon';
import {
  CalendarDate,
  DateField,
  DateTimeField,
  ID,
  IdField,
  IsId,
  NameField,
  Sensitivity,
  SensitivityField,
} from '../../../common';
import { ReportPeriod } from '../../periodic-report/dto';
import { IProject, Project } from './project.dto';
import { ProjectStep } from './step.enum';
import { ProjectType } from './type.enum';

@InputType()
export abstract class CreateProject {
  @NameField()
  readonly name: string;

  @Field(() => ProjectType)
  readonly type: ProjectType;

  @IdField({
    description: 'A primary location ID',
    nullable: true,
  })
  readonly primaryLocationId?: ID;

  @Field(() => [IDType], {
    description: 'Other location IDs',
    nullable: true,
  })
  @IsId({ each: true })
  readonly otherLocationIds?: ID[];

  @IdField({
    description: 'A marketing primary location ID',
    nullable: true,
  })
  readonly marketingLocationId?: ID;

  @IdField({
    description: 'A field region ID',
    nullable: true,
  })
  readonly fieldRegionId?: ID;

  @DateField({ nullable: true })
  readonly mouStart?: CalendarDate;

  @DateField({ nullable: true })
  readonly mouEnd?: CalendarDate;

  @DateField({ nullable: true })
  readonly estimatedSubmission?: CalendarDate;

  @Field(() => ProjectStep, { nullable: true })
  readonly step?: ProjectStep;

  @SensitivityField({
    description: 'Defaults to High, only available on internship projects',
    nullable: true,
  })
  readonly sensitivity?: Sensitivity;

  @Field(() => [String], { nullable: true })
  @Transform(({ value }) => uniq(value))
  readonly tags?: string[] = [];

  @DateTimeField({ nullable: true })
  readonly financialReportReceivedAt?: DateTime;

  @Field(() => ReportPeriod, { nullable: true })
  readonly financialReportPeriod?: ReportPeriod;

  @Field({ nullable: true })
  readonly presetInventory?: boolean;
}

@InputType()
export abstract class CreateProjectInput {
  @Field()
  @Type(() => CreateProject)
  @ValidateNested()
  readonly project: CreateProject;
}

@ObjectType()
export abstract class CreateProjectOutput {
  @Field(() => IProject)
  readonly project: Project;
}
