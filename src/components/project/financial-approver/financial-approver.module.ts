import { Module } from '@nestjs/common';
import { splitDb } from '~/core';
import { FinancialApproverEdgeDBRepository } from './financial-approver.edgedb.repository';
import { FinancialApproverRepository } from './financial-approver.repository';
import { FinancialApproverResolver } from './financial-approver.resolver';
import { FinancialApproverService } from './financial-approver.service';

@Module({
  providers: [
    FinancialApproverService,
    FinancialApproverResolver,
    splitDb(FinancialApproverRepository, FinancialApproverEdgeDBRepository),
  ],
})
export class FinancialApproverModule {}
