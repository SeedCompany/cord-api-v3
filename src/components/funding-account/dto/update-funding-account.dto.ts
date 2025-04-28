import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { Max, Min, ValidateNested } from 'class-validator';
import { ID, IdField, NameField, OptionalField } from '~/common';
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

@InputType()
export abstract class UpdateFundingAccountInput {
  @Field()
  @Type(() => UpdateFundingAccount)
  @ValidateNested()
  readonly fundingAccount: UpdateFundingAccount;
}

@ObjectType()
export abstract class UpdateFundingAccountOutput {
  @Field()
  readonly fundingAccount: FundingAccount;
}
