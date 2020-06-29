import { Type } from '@nestjs/common';
import { Field, ObjectType } from '@nestjs/graphql';
import {
  Resource,
  SecuredInt,
  SecuredProperty,
  SecuredString,
  Sensitivity,
} from '../../../common';

@ObjectType({
  implements: [Resource],
})
export class Language extends Resource {
  /* TS wants a public constructor for "ClassType" */
  static classType = (Language as any) as Type<Language>;

  @Field()
  readonly name: SecuredString;

  @Field()
  readonly displayName: SecuredString;

  @Field()
  readonly beginFiscalYear: SecuredInt;

  @Field()
  readonly ethnologueName: SecuredString;

  @Field()
  readonly ethnologuePopulation: SecuredInt;

  @Field()
  readonly organizationPopulation: SecuredInt;

  @Field()
  readonly rodNumber: SecuredString;

  @Field(() => Sensitivity)
  readonly sensitivity: Sensitivity;
}

@ObjectType({
  description: SecuredProperty.descriptionFor('a language'),
})
export class SecuredLanguage extends SecuredProperty(Language) {}
