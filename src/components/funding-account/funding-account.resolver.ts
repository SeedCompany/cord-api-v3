import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { IdArg, ISession, Session } from '../../common';
import {
  CreateFundingAccountInput,
  CreateFundingAccountOutput,
  FundingAccount,
  FundingAccountListInput,
  FundingAccountListOutput,
  UpdateFundingAccountInput,
  UpdateFundingAccountOutput,
} from './dto';
import { FundingAccountService } from './funding-account.service';

@Resolver(FundingAccount)
export class FundingAccountResolver {
  constructor(private readonly fundingAccountService: FundingAccountService) {}

  @Query(() => FundingAccount, {
    description: 'Look up a funding account by its ID',
  })
  async fundingAccount(
    @Session() session: ISession,
    @IdArg() id: string
  ): Promise<FundingAccount> {
    return this.fundingAccountService.readOne(id, session);
  }

  @Query(() => FundingAccountListOutput, {
    description: 'Look up funding accounts',
  })
  async fundingAccounts(
    @Session() session: ISession,
    @Args({
      name: 'input',
      type: () => FundingAccountListInput,
      defaultValue: FundingAccountListInput.defaultVal,
    })
    input: FundingAccountListInput
  ): Promise<FundingAccountListOutput> {
    return this.fundingAccountService.list(input, session);
  }

  @Mutation(() => CreateFundingAccountOutput, {
    description: 'Create a funding account',
  })
  async createFundingAccount(
    @Session() session: ISession,
    @Args('input') { fundingAccount: input }: CreateFundingAccountInput
  ): Promise<CreateFundingAccountOutput> {
    const fundingAccount = await this.fundingAccountService.create(
      input,
      session
    );
    return { fundingAccount };
  }

  @Mutation(() => UpdateFundingAccountOutput, {
    description: 'Update a funding account',
  })
  async updateFundingAccount(
    @Session() session: ISession,
    @Args('input') { fundingAccount: input }: UpdateFundingAccountInput
  ): Promise<UpdateFundingAccountOutput> {
    const fundingAccount = await this.fundingAccountService.update(
      input,
      session
    );
    return { fundingAccount };
  }

  @Mutation(() => Boolean, {
    description: 'Delete a funding account',
  })
  async deleteFundingAccount(
    @Session() session: ISession,
    @IdArg() id: string
  ): Promise<boolean> {
    await this.fundingAccountService.delete(id, session);
    return true;
  }
}
