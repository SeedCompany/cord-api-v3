import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { DateTime } from 'luxon';
import {
  type CalendarDate,
  DateField,
  DateTimeField,
  type ID,
  IdField,
  type IdOf,
  ListField,
  NameField,
  OptionalField,
  Sensitivity,
  SensitivityField,
} from '~/common';
import { ChangesetIdField } from '../../changeset';
import { type Location } from '../../location/dto';
import { ReportPeriod } from '../../periodic-report/dto';
import { ProjectStep } from './project-step.enum';
import { IProject, type Project } from './project.dto';

@InputType()
export abstract class UpdateProject {
  @IdField()
  readonly id: ID;

  @NameField({ optional: true })
  readonly name?: string;

  @IdField({
    description: 'A primary location ID',
    nullable: true,
  })
  readonly primaryLocationId?: ID | null;

  @IdField({
    description: 'A marketing primary location ID',
    nullable: true,
  })
  readonly marketingLocationId?: ID | null;

  @IdField({
    description: 'A marketing region override location ID',
    nullable: true,
  })
  readonly marketingRegionOverrideId?: IdOf<Location> | null;

  @IdField({
    description: 'A field region ID',
    nullable: true,
  })
  readonly fieldRegionId?: ID | null;

  @DateField({ nullable: true })
  readonly mouStart?: CalendarDate | null;

  @DateField({ nullable: true })
  readonly mouEnd?: CalendarDate | null;

  readonly initialMouEnd?: CalendarDate | null;

  @DateField({ nullable: true })
  readonly estimatedSubmission?: CalendarDate | null;

  @OptionalField(() => ProjectStep, {
    deprecationReason: 'Use `transitionProject` mutation instead',
  })
  readonly step?: ProjectStep;

  @SensitivityField({
    description: 'Update only available to internship projects',
    optional: true,
  })
  readonly sensitivity?: Sensitivity;

  @ListField(() => String, { optional: true })
  readonly tags?: readonly string[];

  @DateTimeField({ nullable: true })
  readonly financialReportReceivedAt?: DateTime;

  @Field(() => ReportPeriod, { nullable: true })
  readonly financialReportPeriod?: ReportPeriod | null;

  @OptionalField()
  readonly presetInventory?: boolean;

  @Field(() => String, { nullable: true })
  readonly departmentId?: string | null;
}

@InputType()
export abstract class UpdateProjectInput {
  @Field()
  @Type(() => UpdateProject)
  @ValidateNested()
  readonly project: UpdateProject;

  @ChangesetIdField()
  readonly changeset?: ID;
}

@ObjectType()
export abstract class UpdateProjectOutput {
  @Field(() => IProject)
  readonly project: Project;
}
