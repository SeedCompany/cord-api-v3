import { Field, InterfaceType, ObjectType } from '@nestjs/graphql';
import { DateTime } from 'luxon';
import { keys as keysOf } from 'ts-transformer-keys';
import { MergeExclusive } from 'type-fest';
import {
  DateTimeField,
  ID,
  parentIdMiddleware,
  Resource,
  Secured,
  SecuredBoolean,
  SecuredDateNullable,
  SecuredDateTime,
  SecuredProps,
  SecuredString,
} from '../../../common';
import { DefinedFile } from '../../file/dto';
import { Product, SecuredMethodologies } from '../../product/dto';
import { SecuredInternPosition } from './intern-position.enum';
import { PnpData } from './pnp-data.dto';
import { SecuredEngagementStatus } from './status.enum';

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
  implements: [Resource],
})
/**
 * This should be used for GraphQL but never for TypeScript types.
 */
class Engagement extends Resource {
  static readonly Props: string[] = keysOf<Engagement>();
  static readonly SecuredProps: string[] = keysOf<SecuredProps<Engagement>>();

  readonly __typename: string;

  @Field(() => SecuredEngagementStatus, {
    middleware: [parentIdMiddleware],
  })
  readonly status: SecuredEngagementStatus;

  readonly ceremony: Secured<ID>;

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
  implements: [Engagement],
})
export class LanguageEngagement extends Engagement {
  static readonly Props = keysOf<LanguageEngagement>();
  static readonly SecuredProps = keysOf<SecuredProps<LanguageEngagement>>();
  static readonly Relations = {
    // why is this singular?
    product: [Product],
  };

  readonly language: Secured<ID>;

  @Field()
  readonly firstScripture: SecuredBoolean;

  @Field()
  readonly lukePartnership: SecuredBoolean;

  @Field({
    description: 'Not used anymore, but exposing for legacy data.',
  })
  readonly sentPrintingDate: SecuredDateNullable;

  @Field()
  readonly paratextRegistryId: SecuredString;

  readonly pnp: DefinedFile;

  @Field({ nullable: true })
  readonly pnpData?: PnpData;

  @Field()
  readonly historicGoal: SecuredString;
}

@ObjectType({
  implements: [Engagement],
})
export class InternshipEngagement extends Engagement {
  static readonly Props = keysOf<InternshipEngagement>();
  static readonly SecuredProps = keysOf<SecuredProps<InternshipEngagement>>();

  readonly countryOfOrigin: Secured<ID>;

  readonly intern: Secured<ID>;

  readonly mentor: Secured<ID>;

  @Field()
  readonly position: SecuredInternPosition;

  @Field()
  readonly methodologies: SecuredMethodologies;

  readonly growthPlan: DefinedFile;
}
