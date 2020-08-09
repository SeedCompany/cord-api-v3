import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { PaginatedList, SortablePaginationInput } from '../../../common';
import { FundingAccount } from './funding-account.dto';

@InputType()
export abstract class FundingAccountFilters {
  @Field({
    description: 'Only funding accounts matching this name',
    nullable: true,
  })
  readonly name?: string;
}

const defaultFilters = {};

@InputType()
export class FundingAccountListInput extends SortablePaginationInput<
  keyof FundingAccount
>({
  defaultSort: 'name',
}) {
  static defaultVal = new FundingAccountListInput();

  @Field({ nullable: true })
  @Type(() => FundingAccountFilters)
  @ValidateNested()
  readonly filter: FundingAccountFilters = defaultFilters;
}

@ObjectType()
export class FundingAccountListOutput extends PaginatedList(FundingAccount) {}
