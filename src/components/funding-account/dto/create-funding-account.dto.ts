import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { NameField } from '../../../common';
import { FundingAccount } from './funding-account.dto';

@InputType()
export abstract class CreateFundingAccount {
  @NameField()
  readonly name: string;

  @Field(() => Int)
  readonly accountNumber: number;
}

@InputType()
export abstract class CreateFundingAccountInput {
  @Field()
  @Type(() => CreateFundingAccount)
  @ValidateNested()
  readonly fundingAccount: CreateFundingAccount;
}

@ObjectType()
export abstract class CreateFundingAccountOutput {
  @Field()
  readonly fundingAccount: FundingAccount;
}
