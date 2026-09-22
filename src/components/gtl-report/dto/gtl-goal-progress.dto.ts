import { Field, ObjectType } from '@nestjs/graphql';
import {
  Resource,
  SecuredDate,
  SecuredIntNullable,
  SecuredRichTextNullable,
  type Sensitivity,
} from '~/common';
import { type LinkTo, RegisterResource } from '~/core/resources';
import { SecuredGtlGoalStatus } from './gtl-goal.enums';

/**
 * One quarter's report on one goal.
 *
 * At most one live entry per (goal, report) — a report says one thing about a
 * goal. Writing one updates the goal's own `status`/`progressValue` in the same
 * transaction, but only if this is the most recent entry by `progressDate`, so
 * backfilling an earlier quarter cannot regress the goal's current state.
 */
@RegisterResource()
@ObjectType({ implements: [Resource] })
export class GtlGoalProgress extends Resource {
  static readonly Parent = () =>
    import('./gtl-goal.dto').then((m) => m.GtlGoal);

  readonly goal: LinkTo<'GtlGoal'>;

  readonly report: LinkTo<'GTLReport'>;

  @Field()
  readonly status: SecuredGtlGoalStatus;

  @Field()
  readonly progressValue: SecuredIntNullable;

  @Field({ description: 'What happened with this goal during the quarter' })
  readonly notes: SecuredRichTextNullable;

  @Field()
  readonly progressDate: SecuredDate;

  readonly sensitivity: Sensitivity;
}

declare module '~/core/resources/map' {
  interface ResourceMap {
    GtlGoalProgress: typeof GtlGoalProgress;
  }
}
