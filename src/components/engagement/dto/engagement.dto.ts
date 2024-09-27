import { Field, InterfaceType, ObjectType } from '@nestjs/graphql';
import { DateTime } from 'luxon';
import { keys as keysOf } from 'ts-transformer-keys';
import { MergeExclusive } from 'type-fest';
import {
  Calculated,
  DateInterval,
  DateTimeField,
  DbLabel,
  DBNames,
  IntersectTypes,
  parentIdMiddleware,
  Resource,
  ResourceRelationsShape,
  Secured,
  SecuredBoolean,
  SecuredDateNullable,
  SecuredDateTimeNullable,
  SecuredProps,
  SecuredRichTextNullable,
  SecuredStringNullable,
  Sensitivity,
  SensitivityField,
  UnsecuredDto,
} from '~/common';
import { BaseNode } from '~/core/database/results';
import { e } from '~/core/edgedb';
import { LinkTo, RegisterResource } from '~/core/resources';
import { ChangesetAware } from '../../changeset/dto';
import { Commentable } from '../../comments/dto';
import { Product, SecuredMethodologies } from '../../product/dto';
import {
  InternshipProject,
  IProject,
  TranslationProject,
} from '../../project/dto';
import { SecuredInternPosition } from './intern-position.enum';
import { SecuredEngagementStatus } from './status.enum';

/**
 * This should be used for TypeScript types as we'll always be passing around
 * concrete engagements.
 */
export type AnyEngagement = MergeExclusive<
  LanguageEngagement,
  InternshipEngagement
>;

const Interfaces = IntersectTypes(Resource, ChangesetAware, Commentable);

export const resolveEngagementType = (val: Pick<AnyEngagement, '__typename'>) =>
  val.__typename === 'default::LanguageEngagement'
    ? LanguageEngagement
    : InternshipEngagement;

@RegisterResource({ db: e.Engagement })
@InterfaceType({
  resolveType: resolveEngagementType,
  implements: Interfaces.members,
})
/**
 * This should be used for GraphQL but never for TypeScript types.
 */
class Engagement extends Interfaces {
  static readonly Props: string[] = keysOf<Engagement>();
  static readonly SecuredProps: string[] = keysOf<SecuredProps<Engagement>>();
  static readonly Relations = {
    ...Commentable.Relations,
  } satisfies ResourceRelationsShape;
  static readonly Parent = () =>
    import('../../project/dto').then((m) => m.IProject);
  static readonly resolve = resolveEngagementType;

  declare readonly __typename: DBNames<typeof e.Engagement>;

  readonly project: LinkTo<'Project'> & Pick<IProject, 'status' | 'type'>;

  @Field(() => IProject)
  declare readonly parent: BaseNode;

  @Field(() => SecuredEngagementStatus, {
    middleware: [parentIdMiddleware],
  })
  @DbLabel('EngagementStatus')
  readonly status: SecuredEngagementStatus;

  readonly ceremony: Secured<LinkTo<'Ceremony'>>;

  @Field({
    description: 'Translation / Growth Plan complete date',
  })
  readonly completeDate: SecuredDateNullable;

  @Field()
  readonly disbursementCompleteDate: SecuredDateNullable;

  @Calculated()
  @Field()
  // Match the project mouStart. Could need to manually set for an extension.
  // formally stage_begin.
  readonly startDate: SecuredDateNullable;

  @Calculated()
  @Field()
  // Match the project mouEnd. Could need to manually set for an extension.
  // formally revised_end.
  readonly endDate: SecuredDateNullable;

  @Field()
  readonly startDateOverride: SecuredDateNullable;

  @Field()
  readonly endDateOverride: SecuredDateNullable;

  @SensitivityField({
    description: "Based on the project's sensitivity",
  })
  readonly sensitivity: Sensitivity;

  @Field()
  // this should match project mouEnd, until it becomes active, then this is final.
  readonly initialEndDate: SecuredDateNullable;

  @Field()
  // Convert from date to datetime at migration
  readonly lastSuspendedAt: SecuredDateTimeNullable;

  @Field()
  // Convert from date to datetime at migration
  readonly lastReactivatedAt: SecuredDateTimeNullable;

  @Field({
    description: 'The last time the engagement status was modified',
  })
  // Convert from last terminated/completed at migration
  readonly statusModifiedAt: SecuredDateTimeNullable;

  @DateTimeField()
  readonly modifiedAt: DateTime;

  @Field()
  readonly description: SecuredRichTextNullable;
}

// class name has to match schema name for interface resolvers to work.
// export as different names to maintain compatibility with our codebase.
export { Engagement as IEngagement, AnyEngagement as Engagement };

@RegisterResource({ db: e.LanguageEngagement })
@ObjectType({
  implements: [Engagement],
})
export class LanguageEngagement extends Engagement {
  static readonly Props = keysOf<LanguageEngagement>();
  static readonly SecuredProps = keysOf<SecuredProps<LanguageEngagement>>();
  static readonly Relations = {
    ...Engagement.Relations,
    // why is this singular?
    product: [Product],
  } satisfies ResourceRelationsShape;
  static readonly Parent = () =>
    import('../../project/dto').then((m) => m.TranslationProject);

  declare readonly __typename: DBNames<typeof e.LanguageEngagement>;

  @Field(() => TranslationProject)
  declare readonly parent: BaseNode;

  readonly language: Secured<LinkTo<'Language'>>;

  @Field()
  readonly firstScripture: SecuredBoolean;

  @Field()
  readonly lukePartnership: SecuredBoolean;

  @Field()
  readonly openToInvestorVisit: SecuredBoolean;

  @Field({
    description: 'Not used anymore, but exposing for legacy data.',
  })
  readonly sentPrintingDate: SecuredDateNullable;

  @Field()
  readonly paratextRegistryId: SecuredStringNullable;

  readonly pnp: Secured<LinkTo<'File'> | null>;

  @Field()
  readonly historicGoal: SecuredStringNullable;
}

@RegisterResource({ db: e.InternshipEngagement })
@ObjectType({
  implements: [Engagement],
})
export class InternshipEngagement extends Engagement {
  static readonly Props = keysOf<InternshipEngagement>();
  static readonly SecuredProps = keysOf<SecuredProps<InternshipEngagement>>();
  static readonly Parent = () =>
    import('../../project/dto').then((m) => m.InternshipProject);

  declare readonly __typename: DBNames<typeof e.InternshipEngagement>;

  @Field(() => InternshipProject)
  declare readonly parent: BaseNode;

  readonly countryOfOrigin: Secured<LinkTo<'Location'> | null>;

  readonly intern: Secured<LinkTo<'User'>>;

  readonly mentor: Secured<LinkTo<'User'> | null>;

  @Field()
  @DbLabel('InternPosition')
  readonly position: SecuredInternPosition;

  @Field()
  @DbLabel('ProductMethodology')
  readonly methodologies: SecuredMethodologies;

  readonly growthPlan: Secured<LinkTo<'File'> | null>;
}

export const engagementRange = (engagement: UnsecuredDto<Engagement>) =>
  DateInterval.tryFrom(engagement.startDate, engagement.endDate);

export const EngagementConcretes = {
  LanguageEngagement,
  InternshipEngagement,
};

declare module '~/core/resources/map' {
  interface ResourceMap {
    Engagement: typeof Engagement;
    InternshipEngagement: typeof InternshipEngagement;
    LanguageEngagement: typeof LanguageEngagement;
  }
  interface ResourceDBMap {
    Engagement: typeof e.default.Engagement;
    InternshipEngagement: typeof e.default.InternshipEngagement;
    LanguageEngagement: typeof e.default.LanguageEngagement;
  }
}
