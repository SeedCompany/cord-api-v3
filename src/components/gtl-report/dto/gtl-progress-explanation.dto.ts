import { Field, InputType, ObjectType } from '@nestjs/graphql';
import {
  type EnumType,
  type ID,
  IdField,
  makeEnum,
  type RichTextDocument,
  RichTextField,
  SecuredEnum,
  SecuredRichTextNullable,
} from '~/common';
import { type LinkTo, RegisterResource } from '~/core/resources';

/**
 * The Field Project Manager's read on how the internship is tracking.
 *
 * Four values, worded exactly as the Stage III template had them. The
 * discovery notes described three (Ahead / On Time / Behind), but "behind"
 * splits into a case with a recovery plan and one that triggers the Change to
 * Plan process — and that distinction is the whole point of the field.
 *
 * The FY27 template dropped this section, so CORD is now its only home.
 * Declared in the same order as the DB enum `gtl_progress_status`
 * (migration 0006).
 */
export type GtlProgressStatus = EnumType<typeof GtlProgressStatus>;
export const GtlProgressStatus = makeEnum({
  name: 'GtlProgressStatus',
  values: [
    { value: 'AheadOfSchedule', label: 'Ahead of Schedule' },
    { value: 'OnTrack', label: 'On Track' },
    {
      value: 'DelayedYetExpectedToCompleteOnTime',
      label: 'Delayed Yet Expected to Complete on Time',
    },
    { value: 'NeedsAChangeToPlan', label: 'Needs a Change to Plan' },
  ],
  exposeOrder: true,
});

@ObjectType({
  description: SecuredEnum.descriptionFor('GTL progress status'),
})
export abstract class SecuredGtlProgressStatusNullable extends SecuredEnum(
  GtlProgressStatus,
  { nullable: true },
) {}

/**
 * Confidential — Field Operations only. A registered resource of its own so
 * the policy engine decides, field by field, who sees it: the Field Partner
 * who wrote the report must never see what their manager said about it, and
 * Marketing sees the status but not the explanation.
 *
 * Keyed by its report rather than carrying an id of its own; at most one per
 * report, and a write is an upsert (the same shape as the Progress Report's
 * variance explanation).
 */
@RegisterResource()
@ObjectType({
  description:
    "The Field Project Manager's explanation of the internship's progress. Confidential — Field Operations only.",
})
export abstract class GtlProgressExplanation {
  static readonly Parent = () =>
    import('./gtl-report.dto').then((m) => m.GTLReport);
  static readonly ConfirmThisClassPassesSensitivityToPolicies = true;

  readonly report: LinkTo<'GTLReport'>;

  @Field(() => SecuredGtlProgressStatusNullable, {
    description: 'Null until an explanation has been given',
  })
  readonly status: SecuredGtlProgressStatusNullable;

  @Field({
    description:
      'Required for anything other than On Track: context for being ahead, delayed, or needing a change to plan.',
  })
  readonly context: SecuredRichTextNullable;
}

@InputType()
export class ExplainGtlProgress {
  @IdField({ description: 'The GTL report being explained' })
  readonly report: ID<'GTLReport'>;

  @Field(() => GtlProgressStatus)
  readonly status: GtlProgressStatus;

  @RichTextField({
    nullable: true,
    description: 'Required unless the status is On Track',
  })
  readonly context?: RichTextDocument | null;
}

declare module '~/core/resources/map' {
  interface ResourceMap {
    GtlProgressExplanation: typeof GtlProgressExplanation;
  }
}
