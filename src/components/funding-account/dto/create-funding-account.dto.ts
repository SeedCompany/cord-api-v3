import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { Max, Min, ValidateNested } from 'class-validator';
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
