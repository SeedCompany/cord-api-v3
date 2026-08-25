import { Field, ObjectType } from '@nestjs/graphql';
import {
  Resource,
  SecuredBooleanNullable,
  SecuredInt,
  SecuredRichTextNullable,
  SecuredString,
  type Sensitivity,
} from '~/common';
import { type LinkTo, RegisterResource } from '~/core/resources';

/**
 * A goal on a GTL quarterly report.
 *
 * One row spans two quarters: the report that SET the goal owns it, and the
 * following quarter's report REVIEWS it in place. That is why `met` and
 * `impact` are nullable and why there are two report links — restating last
 * quarter's goals is a read of this table, not a retype. @see migration 0039
 */
@RegisterResource()
@ObjectType({ implements: [Resource] })
export class GtlReportGoal extends Resource {
  static readonly Parent = () =>
    import('./gtl-report.dto').then((m) => m.GTLReport);

  readonly setInReport: LinkTo<'GTLReport'>;

  /** Null until the following quarter's report reviews this goal. */
  readonly reviewedInReport: LinkTo<'GTLReport'> | null;

  @Field()
  readonly goal: SecuredString;

  @Field({ description: 'Where, when and how the goal will be met' })
  readonly details: SecuredRichTextNullable;

  @Field()
  readonly order: SecuredInt;

  @Field({ description: 'Was the goal met? Set by the reviewing report.' })
  readonly met: SecuredBooleanNullable;

  @Field({
    description:
      'Impact on the Global Translation Leader and the translation projects, including obstacles overcome or reasons a goal went unmet.',
  })
  readonly impact: SecuredRichTextNullable;

  readonly sensitivity: Sensitivity;
}

declare module '~/core/resources/map' {
  interface ResourceMap {
    GtlReportGoal: typeof GtlReportGoal;
  }
}
