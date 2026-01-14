import { type ID } from '~/common';
import { type DataLoaderStrategy, LoaderFactory } from '~/core/data-loader';
import { FundingAccount } from './dto';
import { FundingAccountService } from './funding-account.service';

@LoaderFactory(() => FundingAccount)
export class FundingAccountLoader implements DataLoaderStrategy<
  FundingAccount,
  ID<FundingAccount>
> {
  constructor(private readonly fundingAccounts: FundingAccountService) {}

  async loadMany(ids: ReadonlyArray<ID<FundingAccount>>) {
    return await this.fundingAccounts.readMany(ids);
  }
}
