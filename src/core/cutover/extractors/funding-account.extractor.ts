import { fundingAccounts } from '~/core/drizzle/schema';
import { type FundingAccount } from '../../../components/funding-account/dto';
import { FundingAccountRepository } from '../../../components/funding-account/funding-account.repository';
import { bulkInsert, one, readAllViaRepo, tsReq } from '../cutover.helpers';
import { type Extractor } from '../cutover.types';

/** FundingAccount — leaf domain (id, name, accountNumber). */
export const fundingAccountExtractor: Extractor = {
  name: 'fundingAccount',
  targetTables: ['funding_accounts'],
  async run(ctx) {
    const dtos = await readAllViaRepo<FundingAccount>(
      ctx,
      'FundingAccount',
      FundingAccountRepository,
    );
    const rows = dtos.map((f) => ({
      id: f.id,
      name: f.name,
      accountNumber: f.accountNumber,
      createdAt: tsReq(f.createdAt),
      updatedAt: tsReq(f.createdAt),
      deletedAt: null,
    }));
    return one(
      'funding_accounts',
      dtos.length,
      await bulkInsert(ctx, fundingAccounts, rows),
    );
  },
};
