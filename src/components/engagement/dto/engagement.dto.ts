import { Field, InterfaceType, ObjectType } from '@nestjs/graphql';
import { DateTime } from 'luxon';
import { MergeExclusive } from 'type-fest';
import {
  DateTimeField,
  Resource,
  Secured,
  SecuredBoolean,
  SecuredDateNullable,
  SecuredDateTime,
  SecuredString,
} from '../../../common';
import { DefinedFile } from '../../file/dto';
import { SecuredMethodologies } from '../../product';
import { SecuredInternPosition } from './intern-position.enum';
import { EngagementStatus } from './status.enum';

/**
 * This should be used for TypeScript types as we'll always be passing around
 * concrete engagements.
 */
export type AnyEngagement = MergeExclusive<
  LanguageEngagement,
  InternshipEngagement
>;

@InterfaceType({
  resolveType: (val: AnyEngagement) => val.__typename,
})
/**
 * This should be used for GraphQL but never for TypeScript types.
 */
class Engagement extends Resource {
  readonly __typename: string;

  @Field(() => EngagementStatus)
  readonly status: EngagementStatus; // TODO Workflow

  readonly ceremony: Secured<string>;

  @Field({
    description: 'Translation / Growth Plan complete date',
  })
  readonly completeDate: SecuredDateNullable;

  @Field()
  readonly disbursementCompleteDate: SecuredDateNullable;

  @Field()
  readonly communicationsCompleteDate: SecuredDateNullable;

  @Field()
  // Match the project mouStart. Could need to manually set for an extension.
  // formally stage_begin.
  readonly startDate: SecuredDateNullable;

  @Field()
  // Match the project mouEnd. Could need to manually set for an extension.
  // formally revised_end.
  readonly endDate: SecuredDateNullable;

  @Field()
  readonly startDateOverride: SecuredDateNullable;

  @Field()
  readonly endDateOverride: SecuredDateNullable;

  @Field()
  // this should match project mouEnd, until it becomes active, then this is final.
  readonly initialEndDate: SecuredDateNullable;

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

// class name has to match schema name for interface resolvers to work.
// export as different names to maintain compatibility with our codebase.
export { Engagement as IEngagement, AnyEngagement as Engagement };

@ObjectType({
  implements: [Engagement, Resource],
})
export class LanguageEngagement extends Engagement {
  readonly language: Secured<string>;

  @Field()
  readonly firstScripture: SecuredBoolean;

  @Field()
  readonly lukePartnership: SecuredBoolean;

  @Field({
    description: 'Not used anymore, but exposing for legacy data.',
  })
  readonly sentPrintingDate: SecuredDateNullable;

  @Field()
  readonly paraTextRegistryId: SecuredString;

  readonly pnp: DefinedFile;
}

@ObjectType({
  implements: [Engagement, Resource],
})
export class InternshipEngagement extends Engagement {
  readonly countryOfOrigin: Secured<string>;

  readonly intern: Secured<string>;

  readonly mentor: Secured<string>;

  @Field()
  readonly position: SecuredInternPosition;

  @Field()
  readonly methodologies: SecuredMethodologies;

  readonly growthPlan: DefinedFile;
}
