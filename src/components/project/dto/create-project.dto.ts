import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';
import { Transform, Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { uniq } from 'lodash';
import { DateTime } from 'luxon';
import {
  CalendarDate,
  DateField,
  DateTimeField,
  IdField,
  NameField,
  Sensitivity,
} from '../../../common';
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
  readonly primaryLocationId?: string;

  @Field(() => [ID], {
    description: 'Other location IDs',
    nullable: true,
  })
  readonly otherLocationIds?: string[];

  @IdField({
    description: 'A marketing primary location ID',
    nullable: true,
  })
  readonly marketingLocationId?: string;

  @IdField({
    description: 'A field region ID',
    nullable: true,
  })
  readonly fieldRegionId?: string;

  @DateField({ nullable: true })
  readonly mouStart?: CalendarDate;

  @DateField({ nullable: true })
  readonly mouEnd?: CalendarDate;

  @DateField({ nullable: true })
  readonly estimatedSubmission?: CalendarDate;

  @Field(() => ProjectStep, { nullable: true })
  readonly step?: ProjectStep;

  @Field(() => Sensitivity, {
    description: 'Defaults to High, only available on internship projects',
    nullable: true,
  })
  readonly sensitivity?: Sensitivity;

  @Field(() => [String], { nullable: true })
  @Transform(uniq)
  readonly tags?: string[] = [];

  @DateTimeField({ nullable: true })
  readonly financialReportReceivedAt?: DateTime;
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
