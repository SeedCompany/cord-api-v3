import { Field, ObjectType } from 'type-graphql';
import { Resource, SecuredInt, SecuredString } from '../../../common';

@ObjectType({
  implements: [Resource],
})
export class Language extends Resource {
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
  readonly rodNumber: SecuredInt;
}
