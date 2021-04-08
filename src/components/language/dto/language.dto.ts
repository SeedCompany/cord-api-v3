import { Field, ObjectType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { GraphQLString } from 'graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import {
  ID,
  Resource,
  SecuredBoolean,
  SecuredDate,
  SecuredInt,
  SecuredProperty,
  SecuredPropertyList,
  SecuredProps,
  SecuredString,
  Sensitivity,
} from '../../../common';
import { SetChangeType } from '../../../core/database/changes';
import { Location } from '../../location/dto';
import { UpdateEthnologueLanguage } from './update-language.dto';

@ObjectType({
  description: SecuredPropertyList.descriptionFor('tags'),
})
export abstract class SecuredTags extends SecuredPropertyList<string>(
  GraphQLString
) {}

@ObjectType()
export class EthnologueLanguage {
  static readonly Props = keysOf<EthnologueLanguage>();
  static readonly SecuredProps = keysOf<SecuredProps<EthnologueLanguage>>();

  readonly id: ID;

  @Field({
    description: 'ISO 639-3 code',
  })
  readonly code: SecuredString;

  @Field({
    description: stripIndent`
      Provisional Ethnologue Code.
      Used until official ethnologue code is created by SIL.
    `,
  })
  readonly provisionalCode: SecuredString;

  @Field()
  readonly name: SecuredString;

  @Field()
  readonly population: SecuredInt;

  @Field()
  readonly canDelete: boolean;
}

@ObjectType({
  implements: [Resource],
})
export class Language extends Resource {
  static readonly Props = keysOf<Language>();
  static readonly SecuredProps = keysOf<SecuredProps<Language>>();
  static readonly Relations = {
    ethnologue: EthnologueLanguage,
    locations: [Location],
  };

  @Field({
    description: `The real language name`,
  })
  readonly name: SecuredString;

  @Field({
    description: stripIndent`
      The public name which will be used/shown when real name
      is unauthorized to be viewed/read.
      This should always be viewable.
    `,
  })
  readonly displayName: SecuredString;

  @Field({
    description: 'The pronunciation of the display name',
  })
  readonly displayNamePronunciation: SecuredString;

  @Field({
    description: `Whether this language is a dialect.`,
  })
  readonly isDialect: SecuredBoolean;

  @Field(() => EthnologueLanguage)
  readonly ethnologue: EthnologueLanguage &
    SetChangeType<'ethnologue', UpdateEthnologueLanguage>;

  @Field({
    description: `An override for the ethnologue's population`,
  })
  readonly populationOverride: SecuredInt;

  @Field({
    description: stripIndent`
      Registry of Dialects Code.
      5 digit number including leading zeros.
      https://globalrecordings.net/en/rod
    `,
  })
  readonly registryOfDialectsCode: SecuredString;

  // consider making object
  @Field({
    description: `Whether this language has a Least Of These grant.`,
  })
  readonly leastOfThese: SecuredBoolean;

  @Field({
    description: `Reason why this language is apart of the Least of These program.`,
  })
  readonly leastOfTheseReason: SecuredString;

  @Field()
  readonly signLanguageCode: SecuredString;

  @Field()
  readonly sponsorEstimatedEndDate: SecuredDate;

  // Calculated. Not settable.
  @Field(() => Sensitivity, {
    description: stripIndent`
      The language's sensitivity.
      It's based on its most sensitive location.
    `,
  })
  readonly sensitivity: Sensitivity;

  @Field()
  readonly isSignLanguage: SecuredBoolean;

  @Field()
  readonly hasExternalFirstScripture: SecuredBoolean;

  @Field()
  readonly tags: SecuredTags;
}

@ObjectType({
  description: SecuredProperty.descriptionFor('a language'),
})
export class SecuredLanguage extends SecuredProperty(Language) {}
