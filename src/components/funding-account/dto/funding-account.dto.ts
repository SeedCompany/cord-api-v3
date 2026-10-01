import { Field, ObjectType } from '@nestjs/graphql';
import {
  NameField,
  Resource,
  SecuredInt,
  SecuredProperty,
  SecuredString,
} from '~/common';
import { RegisterResource } from '~/core/resources';

@RegisterResource()
@ObjectType({
  implements: [Resource],
})
export class FundingAccount extends Resource {
  @NameField()
  readonly name: SecuredString;

  @Field()
  readonly accountNumber: SecuredInt;
}

@ObjectType({
  description: SecuredProperty.descriptionFor('a funding account'),
})
export class SecuredFundingAccount extends SecuredProperty(FundingAccount) {}

declare module '~/core/resources/map' {
  interface ResourceMap {
    FundingAccount: typeof FundingAccount;
  }
}
