import { Field, ObjectType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import {
  Resource,
  SecuredBoolean,
  SecuredDate,
  SecuredInt,
  SecuredProperty,
  SecuredString,
  Sensitivity,
} from '../../../common';

@ObjectType()
export class EthnologueLanguage {
  @Field()
  readonly id: SecuredString;

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
}

@ObjectType({
  implements: [Resource],
})
export class Language extends Resource {
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

  @Field()
  readonly ethnologue: EthnologueLanguage;

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

  // Calculated. Not settable.
  @Field({
    description: 'The earliest start date from its engagements',
  })
  readonly sponsorStartDate: SecuredDate;

  // Calculated. Not settable.
  @Field(() => Sensitivity, {
    description: stripIndent`
      The language's sensitivity.
      It's based on its most sensitive location.
    `,
  })
  readonly sensitivity: Sensitivity;
}

@ObjectType({
  description: SecuredProperty.descriptionFor('a language'),
})
export class SecuredLanguage extends SecuredProperty(Language) {}
