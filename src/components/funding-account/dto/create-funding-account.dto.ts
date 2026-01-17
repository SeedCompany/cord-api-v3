import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { Max, Min } from 'class-validator';
import { NameField } from '~/common';
import { FundingAccount } from './funding-account.dto';

@InputType()
export abstract class CreateFundingAccount {
  @NameField()
  readonly name: string;

  @Field(() => Int)
  @Min(0)
  @Max(9)
  readonly accountNumber: number;
}

@ObjectType()
export abstract class FundingAccountCreated {
  @Field()
  readonly fundingAccount: FundingAccount;
}
