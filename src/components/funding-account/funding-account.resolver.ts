import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  AnonSession,
  ID,
  IdArg,
  ListArg,
  LoggedInSession,
  Session,
} from '../../common';
import { Loader, LoaderOf } from '../../core';
import {
  CreateFundingAccountInput,
  CreateFundingAccountOutput,
  DeleteFundingAccountOutput,
  FundingAccount,
  FundingAccountListInput,
  FundingAccountListOutput,
  UpdateFundingAccountInput,
  UpdateFundingAccountOutput,
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
    @AnonSession() session: Session,
    @ListArg(FundingAccountListInput) input: FundingAccountListInput,
    @Loader(FundingAccountLoader)
    fundingAccounts: LoaderOf<FundingAccountLoader>,
  ): Promise<FundingAccountListOutput> {
    const list = await this.fundingAccountService.list(input, session);
    fundingAccounts.primeAll(list.items);
    return list;
  }

  @Mutation(() => CreateFundingAccountOutput, {
    description: 'Create a funding account',
  })
  async createFundingAccount(
    @LoggedInSession() session: Session,
    @Args('input') { fundingAccount: input }: CreateFundingAccountInput,
  ): Promise<CreateFundingAccountOutput> {
    const fundingAccount = await this.fundingAccountService.create(
      input,
      session,
    );
    return { fundingAccount };
  }

  @Mutation(() => UpdateFundingAccountOutput, {
    description: 'Update a funding account',
  })
  async updateFundingAccount(
    @LoggedInSession() session: Session,
    @Args('input') { fundingAccount: input }: UpdateFundingAccountInput,
  ): Promise<UpdateFundingAccountOutput> {
    const fundingAccount = await this.fundingAccountService.update(
      input,
      session,
    );
    return { fundingAccount };
  }

  @Mutation(() => DeleteFundingAccountOutput, {
    description: 'Delete a funding account',
  })
  async deleteFundingAccount(
    @LoggedInSession() session: Session,
    @IdArg() id: ID,
  ): Promise<DeleteFundingAccountOutput> {
    await this.fundingAccountService.delete(id, session);
    return { success: true };
  }
}
