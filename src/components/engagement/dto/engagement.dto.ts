import { Field, InterfaceType, ObjectType } from '@nestjs/graphql';
import { DateTime } from 'luxon';
import { MergeExclusive } from 'type-fest';
import {
  DateTimeField,
  Resource,
  SecuredBoolean,
  SecuredDate,
  SecuredDateTime,
  SecuredString,
} from '../../../common';
import { SecuredCeremony } from '../../ceremony';
import { DefinedFile } from '../../file/dto';
import { SecuredLanguage } from '../../language';
import { SecuredCountry } from '../../location';
import { SecuredMethodologies } from '../../product';
import { SecuredUser } from '../../user';
import { SecuredInternPosition } from './intern-position.enum';
import { EngagementStatus } from './status.enum';

/**
 * This should be used for TypeScript types as we'll always be passing around
 * concrete engagements.
 */
export type Engagement = MergeExclusive<
  LanguageEngagement,
  InternshipEngagement
>;

export const isLanguageEngagement = (
  val: Engagement
): val is LanguageEngagement => 'language' in val;

export const isInternshipEngagement = (
  val: Engagement
): val is InternshipEngagement => !isLanguageEngagement(val);

@InterfaceType('Engagement', {
  resolveType: (val: Engagement) =>
    isLanguageEngagement(val) ? LanguageEngagement : InternshipEngagement,
})
/**
 * This should be used for GraphQL but never for TypeScript types.
 */
export class IEngagement extends Resource {
  @Field(() => EngagementStatus)
  readonly status: EngagementStatus; // TODO Workflow

  @Field()
  readonly ceremony: SecuredCeremony;

  @Field({
    description: 'Translation / Growth Plan complete date',
  })
  readonly completeDate: SecuredDate;

  @Field()
  readonly disbursementCompleteDate: SecuredDate;

  @Field()
  readonly communicationsCompleteDate: SecuredDate;

  @Field()
  // Match the project mouStart. Could need to manually set for an extension.
  // formally stage_begin.
  readonly startDate: SecuredDate;

  @Field()
  // Match the project mouEnd. Could need to manually set for an extension.
  // formally revised_end.
  readonly endDate: SecuredDate;

  @Field()
  // this should match project mouEnd, until it becomes active, then this is final.
  readonly initialEndDate: SecuredDate;

  @Field()
  // Convert from date to datetime at migration
  readonly lastSuspendedAt: SecuredDateTime;

  @Field()
  // Convert from date to datetime at migration
  readonly lastReactivatedAt: SecuredDateTime;

  @Field({
    description: 'The last time the engagement status was modified',
  })
  // Convert from last terminated/completed at migration
  readonly statusModifiedAt: SecuredDateTime;

  @DateTimeField()
  readonly modifiedAt: DateTime;
}

@ObjectType({
  implements: [IEngagement, Resource],
})
export class LanguageEngagement extends IEngagement {
  @Field()
  readonly language: SecuredLanguage;

  @Field()
  readonly firstScripture: SecuredBoolean;

  @Field()
  readonly lukePartnership: SecuredBoolean;

  @Field({
    description: 'Not used anymore, but exposing for legacy data.',
  })
  readonly sentPrintingDate: SecuredDate;

  @Field()
  readonly paraTextRegistryId: SecuredString;

  readonly pnp: DefinedFile;
}

@ObjectType({
  implements: [IEngagement, Resource],
})
export class InternshipEngagement extends IEngagement {
  @Field()
  // To the implementor: We can move this to a separate resolver if we will
  // just be looking up by ID via different query/service call.
  // Talk to Carson.
  readonly countryOfOrigin: SecuredCountry;

  @Field()
  readonly intern: SecuredUser;

  @Field()
  readonly mentor: SecuredUser;

  @Field()
  readonly position: SecuredInternPosition;

  @Field()
  readonly methodologies: SecuredMethodologies;

  readonly growthPlan: DefinedFile;
}
