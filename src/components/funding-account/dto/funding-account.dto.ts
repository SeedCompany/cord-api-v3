/* eslint-disable @typescript-eslint/naming-convention */
import { Field, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import {
  DbLabel,
  DbUnique,
  NameField,
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
  static readonly TablesToDto = {
    id: 'id',
    name: 'name',
    account_number: 'accountNumber',
    created_at: 'createdAt',
  };

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
