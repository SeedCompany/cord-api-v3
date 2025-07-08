import { Field, ObjectType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { GraphQLString } from 'graphql';
import {
  Calculated,
  DbLabel,
  DbUnique,
  type ID,
  IntersectTypes,
  NameField,
  Resource,
  type ResourceRelationsShape,
  SecuredBoolean,
  SecuredDateNullable,
  SecuredIntNullable,
  SecuredProperty,
  SecuredPropertyList,
  SecuredString,
  SecuredStringNullable,
  Sensitivity,
  SensitivityField,
  type SetUnsecuredType,
  type UnsecuredDto,
} from '~/common';
import { type SetChangeType } from '~/core/database/changes';
import { e } from '~/core/gel';
import { type LinkTo, RegisterResource } from '~/core/resources';
import { Commentable } from '../../comments/dto';
import { Location } from '../../location/dto';
import { Pinnable } from '../../pin/dto';
import { Postable } from '../../post/dto';
import { type UpdateEthnologueLanguage } from './update-language.dto';

@ObjectType({
  description: SecuredPropertyList.descriptionFor('tags'),
})
export abstract class SecuredTags extends SecuredPropertyList<string>(
  GraphQLString,
) {}

@RegisterResource({ db: e.Ethnologue.Language })
@ObjectType()
export class EthnologueLanguage {
  static readonly Parent = async () => Language;

  readonly __typename?: 'EthnologueLanguage';

  readonly id: ID;

  @Field({
    description: 'ISO 639-3 code',
  })
  readonly code: SecuredStringNullable;

  @Field({
    description: stripIndent`
      Provisional Ethnologue Code.
      Used until official ethnologue code is created by SIL.
    `,
  })
  readonly provisionalCode: SecuredStringNullable;

  @NameField()
  readonly name: SecuredStringNullable;

  @Field()
  readonly population: SecuredIntNullable;

  @Field()
  readonly canDelete: boolean;

  @SensitivityField({
    description: "Based on the language's sensitivity",
  })
  readonly sensitivity: Sensitivity;
}

const Interfaces = IntersectTypes(Resource, Pinnable, Postable, Commentable);

@RegisterResource({ db: e.Language })
@ObjectType({
  implements: Interfaces.members,
})
export class Language extends Interfaces {
  static readonly Relations = {
    ethnologue: EthnologueLanguage,
    locations: [Location], // a child list but not creating deleting...does it still count?
    ...Postable.Relations,
    ...Commentable.Relations,
  } satisfies ResourceRelationsShape;

  @NameField({
    description: `The real language name`,
  })
  @DbLabel('LanguageName')
  readonly name: SecuredString;

  @NameField({
    description: stripIndent`
      The public name which will be used/shown when real name
      is unauthorized to be viewed/read.
      This should always be viewable.
    `,
  })
  @DbLabel('LanguageDisplayName')
  readonly displayName: SecuredString;

  @Field({
    description: 'The pronunciation of the display name',
  })
  readonly displayNamePronunciation: SecuredStringNullable;

  @Field({
    description: `Whether this language is a dialect.`,
  })
  readonly isDialect: SecuredBoolean;

  @Field(() => EthnologueLanguage)
  readonly ethnologue: EthnologueLanguage &
    SetUnsecuredType<
      UnsecuredDto<EthnologueLanguage> &
        SetChangeType<'ethnologue', UpdateEthnologueLanguage>
    >;

  @Field({
    description: `An override for the ethnologue's population`,
  })
  readonly populationOverride: SecuredIntNullable;

  @Field({
    description: stripIndent`
      Harvest Information System's (HIS) Registry Of Language Varieties' (ROLV) code.
      A 5 digit number including leading zeros.
      https://globalrecordings.net/en/rolv
    `,
  })
  @DbUnique('RegistryOfLanguageVarietiesCode')
  readonly registryOfLanguageVarietiesCode: SecuredStringNullable;

  // consider making object
  @Field({
    description: `Whether this language has a Least Of These grant.`,
  })
  readonly leastOfThese: SecuredBoolean;

  @Field({
    description: `Reason why this language is a part of the Least of These program.`,
  })
  readonly leastOfTheseReason: SecuredStringNullable;

  @Field()
  readonly signLanguageCode: SecuredStringNullable;

  @Field()
  readonly sponsorEstimatedEndDate: SecuredDateNullable;

  @SensitivityField()
  readonly sensitivity: Sensitivity;

  @Field()
  readonly isSignLanguage: SecuredBoolean;

  @Field()
  readonly hasExternalFirstScripture: SecuredBoolean;

  // Internal First Scripture == true via this engagement
  readonly firstScriptureEngagement?: LinkTo<'LanguageEngagement'> | null;

  @Field()
  readonly tags: SecuredTags;

  @Field()
  readonly isAvailableForReporting: SecuredBoolean;

  @Calculated()
  @Field({
    description: stripIndent`
      Whether or not this language is a part of our "Preset Inventory".

      This is true if any engaged, non-closed, projects opt-in to this "Preset Inventory".

      This indicates the language & mention projects will be exposed to major investors.
    `,
  })
  readonly presetInventory: SecuredBoolean;

  // Not returned, only used to cache the sensitivity for determining permissions
  readonly effectiveSensitivity: Sensitivity;
}

@ObjectType({
  description: SecuredProperty.descriptionFor('a language'),
})
export class SecuredLanguage extends SecuredProperty(Language) {}

@ObjectType({
  description: SecuredPropertyList.descriptionFor('a list of languages'),
})
export class SecuredLanguages extends SecuredPropertyList(Language) {}

@ObjectType({
  description: SecuredProperty.descriptionFor('a language or null'),
})
export class SecuredLanguageNullable extends SecuredProperty(Language, {
  nullable: true,
}) {}

declare module '~/core/resources/map' {
  interface ResourceMap {
    EthnologueLanguage: typeof EthnologueLanguage;
    Language: typeof Language;
  }
  interface ResourceDBMap {
    EthnologueLanguage: typeof e.Ethnologue.Language;
    Language: typeof e.default.Language;
  }
}
