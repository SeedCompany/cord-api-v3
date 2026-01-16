import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { Max, Min } from 'class-validator';
import { type ID, IdField, NameField, OptionalField } from '~/common';
import { FundingAccount } from './funding-account.dto';

@InputType()
export abstract class UpdateFundingAccount {
  @IdField()
  readonly id: ID;

  @NameField({ optional: true })
  readonly name?: string;

  @OptionalField(() => Int)
  @Min(0)
  @Max(9)
  readonly accountNumber?: number;
}

@ObjectType()
export abstract class UpdateFundingAccountOutput {
  @Field()
  readonly fundingAccount: FundingAccount;
}
