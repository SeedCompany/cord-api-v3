import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import {
  CalendarDate,
  DateField,
  IdField,
  NameField,
  Sensitivity,
} from '../../../common';
import { IProject, Project } from './project.dto';
import { ProjectStep } from './step.enum';

@InputType()
export abstract class UpdateProject {
  @IdField()
  readonly id: string;

  @NameField({ nullable: true })
  readonly name?: string;

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
    description: 'Update only available to internship projects',
    nullable: true,
  })
  readonly sensitivity?: Sensitivity;
}

@InputType()
export abstract class UpdateProjectInput {
  @Field()
  @Type(() => UpdateProject)
  @ValidateNested()
  readonly project: UpdateProject;
}

@ObjectType()
export abstract class UpdateProjectOutput {
  @Field(() => IProject)
  readonly project: Project;
}
