import { Field, ObjectType } from '@nestjs/graphql';
import { Resource, SecuredProperty, SecuredString } from '../../../common';

@ObjectType({
  implements: [Resource],
})
export class FundingAccount extends Resource {
  @Field()
  readonly name: SecuredString;
}

@ObjectType({
  description: SecuredProperty.descriptionFor('a funding account'),
})
export class SecuredFundingAccount extends SecuredProperty(FundingAccount) {}
