import { Module } from '@nestjs/common';
import { FinancialApproverRepository } from './financial-approver.repository';
import { FinancialApproverResolver } from './financial-approver.resolver';

@Module({
  providers: [FinancialApproverResolver, FinancialApproverRepository],
  exports: [FinancialApproverRepository],
})
export class FinancialApproverModule {}
