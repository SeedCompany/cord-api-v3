import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { type ID, IdArg, ListArg } from '~/common';
import { Loader, type LoaderOf } from '~/core';
import {
  CreateFundingAccount,
  FundingAccount,
  FundingAccountCreated,
  FundingAccountDeleted,
  FundingAccountListInput,
  FundingAccountListOutput,
  FundingAccountUpdated,
  UpdateFundingAccount,
} from './dto';
import { FundingAccountLoader } from './funding-account.loader';
import { FundingAccountService } from './funding-account.service';

@Resolver(FundingAccount)
export class FundingAccountResolver {
  constructor(private readonly fundingAccountService: FundingAccountService) {}

  @Query(() => FundingAccount, {
    description: 'Look up a funding account by its ID',
  })
  async fundingAccount(
    @Loader(FundingAccountLoader)
    fundingAccounts: LoaderOf<FundingAccountLoader>,
    @IdArg() id: ID,
  ): Promise<FundingAccount> {
    return await fundingAccounts.load(id);
  }

  @Query(() => FundingAccountListOutput, {
    description: 'Look up funding accounts',
  })
  async fundingAccounts(
    @ListArg(FundingAccountListInput) input: FundingAccountListInput,
    @Loader(FundingAccountLoader)
    fundingAccounts: LoaderOf<FundingAccountLoader>,
  ): Promise<FundingAccountListOutput> {
    const list = await this.fundingAccountService.list(input);
    fundingAccounts.primeAll(list.items);
    return list;
  }

  @Mutation(() => FundingAccountCreated, {
    description: 'Create a funding account',
  })
  async createFundingAccount(
    @Args('input') input: CreateFundingAccount,
  ): Promise<FundingAccountCreated> {
    const fundingAccount = await this.fundingAccountService.create(input);
    return { fundingAccount };
  }

  @Mutation(() => FundingAccountUpdated, {
    description: 'Update a funding account',
  })
  async updateFundingAccount(
    @Args('input') input: UpdateFundingAccount,
  ): Promise<FundingAccountUpdated> {
    const fundingAccount = await this.fundingAccountService.update(input);
    return { fundingAccount };
  }

  @Mutation(() => FundingAccountDeleted, {
    description: 'Delete a funding account',
  })
  async deleteFundingAccount(@IdArg() id: ID): Promise<FundingAccountDeleted> {
    await this.fundingAccountService.delete(id);
    return {};
  }
}
