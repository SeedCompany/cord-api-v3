import { Field, Int, ObjectType } from '@nestjs/graphql';
import {
  Calculated,
  Resource,
  SecuredDateNullable,
  SecuredInt,
  SecuredIntNullable,
  SecuredRichTextNullable,
  SecuredString,
  SecuredStringNullable,
  type Sensitivity,
} from '~/common';
import { type LinkTo, RegisterResource } from '~/core/resources';
import { type ScopedRole } from '../../authorization/dto/role.dto';
import {
  GtlGoalScheduleStatus,
  SecuredGtlGoalMeasurement,
  SecuredGtlGoalStatus,
} from './gtl-goal.enums';

/**
 * A goal on a Global Translation Leader's growth plan.
 *
 * Belongs to the engagement rather than to one quarter's report: a goal with a
 * target date several quarters out is reported against every quarter along the
 * way. `setInReport` records where it was first proposed.
 *
 * `status` and `progressValue` are the latest quarter's word on the goal —
 * derived when read from its most recent live `GtlGoalProgress` entry on a
 * live report, never stored on the goal itself.
 */
@RegisterResource()
@ObjectType({ implements: [Resource] })
export class GtlGoal extends Resource {
  static readonly Parent = () =>
    import('../../engagement/dto').then((m) => m.InternshipEngagement);

  readonly engagement: LinkTo<'InternshipEngagement'>;

  /** The report this goal was first proposed in, if it came from one. */
  readonly setInReport: LinkTo<'GTLReport'> | null;

  @Field()
  readonly goal: SecuredString;

  @Field({ description: 'Where, when and how the goal will be met' })
  readonly details: SecuredRichTextNullable;

  @Field({ description: 'When this goal is meant to be complete' })
  readonly targetDate: SecuredDateNullable;

  @Field()
  readonly measurement: SecuredGtlGoalMeasurement;

  @Field({
    description: 'The number being counted toward, when measured by Number',
  })
  readonly targetNumber: SecuredIntNullable;

  @Field({ description: 'What is being counted, e.g. "workshops facilitated"' })
  readonly targetDescription: SecuredStringNullable;

  @Field({
    description:
      'The latest reported value: a count for Number, 0-100 for Percent, unused for Done / Not done',
  })
  @Calculated()
  readonly progressValue: SecuredIntNullable;

  @Field({
    description:
      'The latest reported status. Changes through `reportGtlGoalProgress`, not by editing the goal.',
  })
  @Calculated()
  readonly status: SecuredGtlGoalStatus;

  @Field(() => Int, {
    description:
      'How complete this goal is, 0-100, derived from its measurement.',
  })
  @Calculated()
  readonly percentComplete: number;

  @Field(() => GtlGoalScheduleStatus, {
    nullable: true,
    description:
      'Whether the goal is tracking against its target date. Null when it has no target date, or is cancelled.',
  })
  @Calculated()
  readonly scheduleStatus: GtlGoalScheduleStatus | null;

  @Field()
  readonly order: SecuredInt;

  /** The owning project's, for the sensitivity policy conditions. */
  readonly sensitivity: Sensitivity;

  /** The requester's membership roles on the owning project. */
  declare readonly scope: readonly ScopedRole[];
}

declare module '~/core/resources/map' {
  interface ResourceMap {
    GtlGoal: typeof GtlGoal;
  }
}
