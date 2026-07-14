import { type ID } from '~/common';
import { fundingAccounts } from '~/core/drizzle/schema';
import { type FundingAccount } from '../../../components/funding-account/dto';
import { FundingAccountRepository } from '../../../components/funding-account/funding-account.repository';
import {
  bulkInsert,
  cypher,
  one,
  readAllViaRepo,
  tsReq,
} from '../cutover.helpers';
import { type Extractor } from '../cutover.types';

/**
 * FundingAccount (id, name, accountNumber) + its department-id-block FK —
 * resolved via the fa→block rel like the partner extractor (audit finding
 * FUNDINGACCOUNT-1: the column landed with migration 0014, after this
 * extractor was first written; without it SetDepartmentId's PG join finds
 * zero rows for every migrated account).
 */
export const fundingAccountExtractor: Extractor = {
  name: 'fundingAccount',
  targetTables: ['funding_accounts'],
  dependsOn: ['departmentIdBlock'],
  async run(ctx) {
    const dtos = await readAllViaRepo<FundingAccount>(
      ctx,
      'FundingAccount',
      FundingAccountRepository,
    );

    const blockPairs = await cypher<{ fid: ID; bid: ID }>(
      ctx,
      `MATCH (f:FundingAccount)-[:departmentIdBlock { active: true }]->(b:DepartmentIdBlock)
       RETURN f.id AS fid, b.id AS bid`,
    );
    const blockByAccount = new Map(blockPairs.map((row) => [row.fid, row.bid]));

    const rows = dtos.map((f) => ({
      id: f.id,
      name: f.name,
      accountNumber: f.accountNumber,
      departmentIdBlockId: blockByAccount.get(f.id) ?? null,
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
