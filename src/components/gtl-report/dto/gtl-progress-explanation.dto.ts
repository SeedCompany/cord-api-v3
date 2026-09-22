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

/**
 * The FPM's read on how the internship is tracking.
 *
 * Four values, worded exactly as the Stage III template had them. The
 * discovery notes described three (Ahead / On Time / Behind), but "behind"
 * splits into a case with a recovery plan and one that triggers the Change to
 * Plan process — and that distinction is the whole point of the field.
 *
 * The FY27 template dropped this section, so Cord is now its only home.
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
export abstract class SecuredGtlProgressStatus extends SecuredEnum(
  GtlProgressStatus,
) {}

@ObjectType({
  description:
    "The Field Project Manager's explanation of the internship's progress. Confidential — Field Operations only.",
})
export abstract class GtlProgressExplanation {
  @Field(() => SecuredGtlProgressStatus)
  readonly status: SecuredGtlProgressStatus;

  @Field({
    description:
      'Required by the app for anything other than On Track: context for being ahead, delayed, or needing a change to plan.',
  })
  readonly context: SecuredRichTextNullable;
}

@InputType()
export class ExplainGtlProgress {
  @IdField()
  readonly report: ID;

  @Field(() => GtlProgressStatus)
  readonly status: GtlProgressStatus;

  @RichTextField({ nullable: true })
  readonly context?: RichTextDocument | null;
}
