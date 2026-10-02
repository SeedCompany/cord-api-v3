import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { IsNotEmpty, IsOptional, IsPositive } from 'class-validator';
import {
  type CalendarDate,
  DateField,
  type ID,
  IdField,
  type RichTextDocument,
  RichTextField,
} from '~/common';
import { GtlGoalProgress } from './gtl-goal-progress.dto';
import { GtlGoal } from './gtl-goal.dto';
import { GtlGoalMeasurement, GtlGoalStatus } from './gtl-goal.enums';

@InputType()
export class CreateGtlGoal {
  @IdField({ description: 'The GTL engagement this goal belongs to' })
  readonly engagement: ID<'InternshipEngagement'>;

  @IdField({
    nullable: true,
    description:
      'The report this goal is being proposed in, if any. Must be a GTL report on the same engagement.',
  })
  readonly setInReport?: ID<'GTLReport'> | null;

  @Field()
  @IsNotEmpty()
  readonly goal: string;

  @RichTextField({ nullable: true })
  readonly details?: RichTextDocument | null;

  @DateField({ nullable: true })
  readonly targetDate?: CalendarDate | null;

  @Field(() => GtlGoalMeasurement, {
    nullable: true,
    description: 'Defaults to Done / Not done',
  })
  readonly measurement?: GtlGoalMeasurement;

  @Field(() => Int, {
    nullable: true,
    description: 'Required for, and only allowed on, goals measured by Number',
  })
  // `IsOptional` first, so a null/omitted value reaches the service's shape
  // rule (a field-attributed input error) instead of failing validation.
  @IsOptional()
  @IsPositive()
  readonly targetNumber?: number | null;

  @Field(() => String, {
    nullable: true,
    description: 'What is being counted. Required for goals measured by Number',
  })
  readonly targetDescription?: string | null;

  @Field(() => Int, { nullable: true })
  readonly order?: number;
}

@InputType()
export class UpdateGtlGoal {
  @IdField()
  readonly id: ID<'GtlGoal'>;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsNotEmpty()
  readonly goal?: string;

  @RichTextField({ nullable: true })
  readonly details?: RichTextDocument | null;

  @DateField({ nullable: true })
  readonly targetDate?: CalendarDate | null;

  @Field(() => GtlGoalMeasurement, { nullable: true })
  readonly measurement?: GtlGoalMeasurement;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsPositive()
  readonly targetNumber?: number | null;

  @Field(() => String, { nullable: true })
  readonly targetDescription?: string | null;

  @Field(() => Int, { nullable: true })
  readonly order?: number;
}

/**
 * Report progress on a goal from a given quarter.
 *
 * Upserts the (goal, report) entry rather than creating a second one — a report
 * says one thing about a goal, and revising it should read as a correction
 * rather than as two conflicting statements.
 */
@InputType()
export class ReportGtlGoalProgress {
  @IdField()
  readonly goal: ID<'GtlGoal'>;

  @IdField({
    description:
      'The report this progress is being reported in. Must be a GTL report on the goal’s engagement.',
  })
  readonly report: ID<'GTLReport'>;

  @Field(() => GtlGoalStatus)
  readonly status: GtlGoalStatus;

  @Field(() => Int, {
    nullable: true,
    description: 'A count for Number, 0-100 for Percent, unused for Boolean',
  })
  readonly progressValue?: number | null;

  @RichTextField({ nullable: true })
  readonly notes?: RichTextDocument | null;

  @DateField({
    nullable: true,
    description: "Defaults to the report's period end when omitted",
  })
  readonly progressDate?: CalendarDate | null;
}

@ObjectType()
export abstract class GtlGoalCreated {
  @Field()
  readonly gtlGoal: GtlGoal;
}

@ObjectType()
export abstract class GtlGoalUpdated {
  @Field()
  readonly gtlGoal: GtlGoal;
}

@ObjectType()
export abstract class GtlGoalProgressReported {
  @Field()
  readonly progress: GtlGoalProgress;

  @Field({ description: 'The goal, as it now reads with this entry in place' })
  readonly gtlGoal: GtlGoal;
}
