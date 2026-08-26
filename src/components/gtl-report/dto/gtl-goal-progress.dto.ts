import { Field, Int, ObjectType } from '@nestjs/graphql';
import { GtlReportGoal } from './gtl-report-goal.dto';

/**
 * An engagement's goals across every quarter, plus how they are tracking.
 *
 * Deliberately NOT called `growthPlan`: `InternshipEngagement` already has a
 * field by that name — a SecuredFile for the Growth Plan document — and the
 * two would collide.
 *
 * This is the growth plan as it has actually accumulated report by report,
 * rather than a plan authored up front — the Growth Plan document itself is a
 * later pass. `met` and `unmet` only count goals a following quarter has
 * actually reviewed; everything else is still open, which is why the three
 * counts do not have to sum to `total`.
 */
@ObjectType({
  description: "A Global Translation Leader's goals across every quarter",
})
export abstract class GtlGoalProgress {
  @Field(() => [GtlReportGoal])
  readonly goals: readonly GtlReportGoal[];

  @Field(() => Int)
  readonly total: number;

  @Field(() => Int, { description: 'Goals a later quarter reviewed as met' })
  readonly met: number;

  @Field(() => Int, { description: 'Goals a later quarter reviewed as unmet' })
  readonly unmet: number;

  @Field(() => Int, {
    description: 'Goals set but not yet reviewed by a following quarter',
  })
  readonly awaitingReview: number;
}
