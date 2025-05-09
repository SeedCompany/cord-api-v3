import { Field, ObjectType } from '@nestjs/graphql';
import {
  DbLabel,
  DbUnique,
  NameField,
  Resource,
  SecuredInt,
  SecuredProperty,
  SecuredString,
} from '~/common';
import { e } from '~/core/gel';
import { RegisterResource } from '~/core/resources';

@RegisterResource({ db: e.FundingAccount })
@ObjectType({
  implements: [Resource],
})
export class FundingAccount extends Resource {
  @NameField()
  @DbUnique()
  readonly name: SecuredString;

  @Field()
  @DbLabel('FundingAccountNumber')
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
  interface ResourceDBMap {
    FundingAccount: typeof e.default.FundingAccount;
  }
}
