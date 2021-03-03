import { Field, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import {
  Resource,
  SecuredInt,
  SecuredProperty,
  SecuredProps,
  SecuredString,
} from '../../../common';

@ObjectType({
  implements: [Resource],
})
export class FundingAccount extends Resource {
  static readonly Props = keysOf<FundingAccount>();
  static readonly SecuredProps = keysOf<SecuredProps<FundingAccount>>();

  @Field()
  readonly name: SecuredString;

  @Field()
  readonly accountNumber: SecuredInt;
}

@ObjectType({
  description: SecuredProperty.descriptionFor('a funding account'),
})
export class SecuredFundingAccount extends SecuredProperty(FundingAccount) {}
