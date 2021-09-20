import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AnonSession, ID, IdArg, LoggedInSession, Session } from '../../common';
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
    @AnonSession() session: Session,
    @IdArg() id: ID
  ): Promise<FundingAccount> {
    return await this.fundingAccountService.readOne(id, session);
  }

  @Query(() => FundingAccountListOutput, {
    description: 'Look up funding accounts',
  })
  async fundingAccounts(
    @AnonSession() session: Session,
    @Args({
      name: 'input',
      type: () => FundingAccountListInput,
      defaultValue: FundingAccountListInput.defaultVal,
    })
    input: FundingAccountListInput
  ): Promise<FundingAccountListOutput> {
    return await this.fundingAccountService.list(input, session);
  }

  @Mutation(() => CreateFundingAccountOutput, {
    description: 'Create a funding account',
  })
  async createFundingAccount(
    @LoggedInSession() session: Session,
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
    @LoggedInSession() session: Session,
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
    @LoggedInSession() session: Session,
    @IdArg() id: ID
  ): Promise<boolean> {
    await this.fundingAccountService.delete(id, session);
    return true;
  }
}
