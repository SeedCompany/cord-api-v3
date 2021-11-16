import { Injectable, Scope } from '@nestjs/common';
import { ID } from '../../common';
import { OrderedNestDataLoader } from '../../core';
import { FundingAccount } from './dto';
import { FundingAccountService } from './funding-account.service';

@Injectable({ scope: Scope.REQUEST })
export class FundingAccountLoader extends OrderedNestDataLoader<FundingAccount> {
  constructor(private readonly fundingAccounts: FundingAccountService) {
    super();
  }

  async loadMany(ids: readonly ID[]) {
    return await this.fundingAccounts.readMany(ids, this.session);
  }
}
