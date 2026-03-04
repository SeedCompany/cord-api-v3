import { Module } from '@nestjs/common';
import { splitDb } from '~/core/database';
import { FinancialApproverNeo4jRepository } from './financial-approver-neo4j.repository';
import { FinancialApproverRepository } from './financial-approver.repository';
import { FinancialApproverResolver } from './financial-approver.resolver';

@Module({
  providers: [
    FinancialApproverResolver,
    splitDb(FinancialApproverRepository, {
      neo4j: FinancialApproverNeo4jRepository,
    }),
  ],
  exports: [FinancialApproverRepository],
})
export class FinancialApproverModule {}
