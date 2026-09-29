import { Module } from '@nestjs/common';
import { splitDb } from '~/core/database';
import { FinancialApproverDrizzleRepository } from './financial-approver.drizzle.repository';
import { FinancialApproverRepository } from './financial-approver.repository';
import { FinancialApproverResolver } from './financial-approver.resolver';

@Module({
  providers: [
    FinancialApproverResolver,
    splitDb(FinancialApproverRepository, {
      // migration-todo: drop the `as any` when splitDb goes with the Neo4j
      // path. It is needed because splitDb demands the full public surface of
      // the canonical, which now includes CommonRepository plumbing that has no
      // Postgres counterpart; the repository itself still declares the real
      // contract via `Pick<PublicOf<…>, 'read' | 'write'>`.
      postgres: FinancialApproverDrizzleRepository as any,
    }),
  ],
  exports: [FinancialApproverRepository],
})
export class FinancialApproverModule {}
