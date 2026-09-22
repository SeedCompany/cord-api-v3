import { Field, Int, ObjectType } from '@nestjs/graphql';
import { GtlGoal } from './gtl-goal.dto';

/**
 * A Global Translation Leader's whole growth plan, and how it is tracking.
 *
 * Named a summary rather than "progress" because `GtlGoalProgress` is the
 * per-quarter entry against a single goal; this is the rollup across all of
 * them.
 *
 * The counts are by status, so they sum to `total`. `percentComplete` averages
 * each goal's own completion rather than counting done-ness, so a goal that is
 * 60% of the way to its target contributes 60 rather than 0.
 */
@ObjectType({
  description: "A Global Translation Leader's goals and how they are tracking",
})
export abstract class GtlGoalSummary {
  @Field(() => [GtlGoal])
  readonly goals: readonly GtlGoal[];

  @Field(() => Int)
  readonly total: number;

  @Field(() => Int)
  readonly done: number;

  @Field(() => Int, { description: 'Planned or in progress' })
  readonly active: number;

  @Field(() => Int, { description: 'At risk or on hold' })
  readonly needsAttention: number;

  @Field(() => Int)
  readonly behindSchedule: number;

  @Field(() => Int, {
    description: 'Average completion across every goal, 0-100',
  })
  readonly percentComplete: number;
}
