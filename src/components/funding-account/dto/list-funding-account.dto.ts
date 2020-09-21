import { InputType, ObjectType } from '@nestjs/graphql';
import { PaginatedList, SortablePaginationInput } from '../../../common';
import { FundingAccount } from './funding-account.dto';

@InputType()
export class FundingAccountListInput extends SortablePaginationInput<
  keyof FundingAccount
>({
  defaultSort: 'name',
}) {
  static defaultVal = new FundingAccountListInput();
}

@ObjectType()
export class FundingAccountListOutput extends PaginatedList(FundingAccount) {}
