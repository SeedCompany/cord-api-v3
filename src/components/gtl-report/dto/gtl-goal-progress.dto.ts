import { Field, ObjectType } from '@nestjs/graphql';
import {
  Resource,
  SecuredDate,
  SecuredIntNullable,
  SecuredRichTextNullable,
  type Sensitivity,
} from '~/common';
import { type LinkTo, RegisterResource } from '~/core/resources';
import { type ScopedRole } from '../../authorization/dto/role.dto';
import { SecuredGtlGoalStatus } from './gtl-goal.enums';

/**
 * One quarter's report on one goal.
 *
 * At most one live entry per (goal, report) — a report says one thing about a
 * goal, and revising it is a correction, not a second statement. The goal's own
 * `status`/`progressValue` are read from the latest of these by `progressDate`,
 * so backfilling an earlier quarter cannot regress the goal's current state.
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

  @Field({
    description:
      "The date this progress describes. Defaults to the report's period end.",
  })
  readonly progressDate: SecuredDate;

  /** The owning project's, for the sensitivity policy conditions. */
  readonly sensitivity: Sensitivity;

  /** The requester's membership roles on the owning project. */
  declare readonly scope: readonly ScopedRole[];
}

declare module '~/core/resources/map' {
  interface ResourceMap {
    GtlGoalProgress: typeof GtlGoalProgress;
  }
}
