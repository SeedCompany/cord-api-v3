import { Type } from '@nestjs/common';
import { Field, ObjectType } from 'type-graphql';
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

  @Field({ nullable: true })
  readonly beginFiscalYear?: SecuredInt;

  @Field({ nullable: true })
  readonly ethnologueName: SecuredString;

  @Field({ nullable: true })
  readonly ethnologuePopulation: SecuredInt;

  @Field({ nullable: true })
  readonly organizationPopulation: SecuredInt;

  @Field({ nullable: true })
  readonly rodNumber: SecuredInt;

  @Field(() => Sensitivity, { nullable: true })
  readonly sensitivity: Sensitivity;
}

@ObjectType({
  description: SecuredProperty.descriptionFor('a language'),
})
export class SecuredLanguage extends SecuredProperty(Language) {}
