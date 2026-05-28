import { InputType, ObjectType } from '@nestjs/graphql';
import { PaginatedList, SortablePaginationInput } from '~/common';
import { FundingAccount } from './funding-account.dto';

// migration-todo: no filter input (parity with the Neo4j repo, which also has
// none). Add FundingAccountFilters + a `filter` field here if a consumer needs
// to filter by name/accountNumber; the Drizzle repo's list() already composes
// conditions and is ready to accept them.
@InputType()
export class FundingAccountListInput extends SortablePaginationInput<
  keyof FundingAccount
>({
  defaultSort: 'name',
}) {}

@ObjectType()
export class FundingAccountListOutput extends PaginatedList(FundingAccount) {}
