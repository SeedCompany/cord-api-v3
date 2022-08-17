import { ID } from '../../common';
import { LoaderFactory, OrderedNestDataLoader } from '../../core';
import { FundingAccount } from './dto';
import { FundingAccountService } from './funding-account.service';

@LoaderFactory(() => FundingAccount)
export class FundingAccountLoader extends OrderedNestDataLoader<FundingAccount> {
  constructor(private readonly fundingAccounts: FundingAccountService) {
    super();
  }

  async loadMany(ids: readonly ID[]) {
    return await this.fundingAccounts.readMany(ids, this.session);
  }
}
