import { Field, ObjectType } from '@nestjs/graphql';
import {
  Resource,
  SecuredKeys,
  SecuredProperty,
  SecuredString,
} from '../../../common';

@ObjectType({
  implements: [Resource],
})
export class FundingAccount extends Resource {
  @Field()
  readonly name: SecuredString;
}

declare module '../../authorization/policies/mapping' {
  interface TypeToDto {
    FundingAccount: FundingAccount;
  }
  interface TypeToSecuredProps {
    FundingAccount: SecuredKeys<FundingAccount>;
  }
}

@ObjectType({
  description: SecuredProperty.descriptionFor('a funding account'),
})
export class SecuredFundingAccount extends SecuredProperty(FundingAccount) {}
