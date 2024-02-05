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
  IdOf,
  IsId,
  NameField,
  Sensitivity,
  SensitivityField,
} from '../../../common';
import { FieldRegion } from '../../../components/field-region';
import { Location } from '../../location/dto';
import { ReportPeriod } from '../../periodic-report/dto';
import { ProjectStep } from './project-step.enum';
import { ProjectType } from './project-type.enum';
import { IProject, Project } from './project.dto';

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
    description:
      'A Country Location ID for marketing (overriding the primary location)',
    nullable: true,
  })
  readonly marketingCountryOverrideId?: ID;

  @IdField({
    description: 'A marketing region override location ID',
    nullable: true,
  })
  readonly marketingRegionOverrideId?: IdOf<Location> | null;

  @IdField({
    description: 'A field region ID',
    nullable: true,
  })
  readonly fieldRegionOverrideId?: IdOf<FieldRegion>;

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
