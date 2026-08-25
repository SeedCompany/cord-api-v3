import { Field, InputType, ObjectType } from '@nestjs/graphql';
import {
  type ID,
  IdField,
  type RichTextDocument,
  RichTextField,
} from '~/common';
import { GtlReportGoal } from './gtl-report-goal.dto';

@InputType()
export class UpdateGtlReportGoal {
  @IdField()
  readonly id: ID;

  @Field({ nullable: true })
  readonly goal?: string;

  @RichTextField({ nullable: true })
  readonly details?: RichTextDocument | null;

  @Field({ nullable: true })
  readonly order?: number;
}

/**
 * Reviewing a goal is its own mutation, not part of UpdateGtlReportGoal.
 *
 * The goal's parent is the report that SET it, which by review time is usually
 * Published and locked. Authorising a review against that report would either
 * block the review or unlock the goal text — so the review names the reviewing
 * report explicitly and is authorised against that one instead.
 */
@InputType()
export class ReviewGtlReportGoal {
  @IdField()
  readonly id: ID;

  @IdField({ description: 'The report doing the reviewing' })
  readonly reviewedInReport: ID;

  @Field({ description: 'Was the goal met?' })
  readonly met: boolean;

  @RichTextField({ nullable: true })
  readonly impact?: RichTextDocument | null;
}

@ObjectType()
export abstract class GtlReportGoalUpdated {
  @Field()
  readonly gtlReportGoal: GtlReportGoal;
}
