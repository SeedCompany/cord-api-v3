import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { DateTime } from 'luxon';
import {
  type CalendarDate,
  DateField,
  DateTimeField,
  type ID,
  IdField,
  ListField,
  NameField,
  OptionalField,
  Sensitivity,
  SensitivityField,
} from '~/common';
import { ChangesetIdField } from '../../changeset';
import { ReportPeriod } from '../../periodic-report/dto';
import { IProject, type Project } from './project.dto';

@ObjectType({ isAbstract: true })
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
  readonly primaryLocation?: ID<'Location'> | null;

  @IdField({
    description: 'A marketing primary location ID',
    nullable: true,
  })
  readonly marketingLocation?: ID<'Location'> | null;

  @IdField({
    description: 'A marketing region override location ID',
    nullable: true,
  })
  readonly marketingRegionOverride?: ID<'Location'> | null;

  @IdField({
    description: 'A field region ID',
    nullable: true,
  })
  readonly fieldRegion?: ID<'FieldRegion'> | null;

  @DateField({ nullable: true })
  readonly mouStart?: CalendarDate | null;

  @DateField({ nullable: true })
  readonly mouEnd?: CalendarDate | null;

  readonly initialMouEnd?: CalendarDate | null;

  @DateField({ nullable: true })
  readonly estimatedSubmission?: CalendarDate | null;

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

  @ChangesetIdField()
  readonly changeset?: ID;
}

@ObjectType()
export abstract class UpdateProjectOutput {
  @Field(() => IProject)
  readonly project: Project;
}
