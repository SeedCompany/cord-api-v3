import { Module } from '@nestjs/common';
import { splitDb } from '~/core';
import { ProjectTypeFinancialApproverEdgeDBRepository } from './project-type-financial-approver.edgedb.repository';
import { ProjectTypeFinancialApproverRepository } from './project-type-financial-approver.repository';
import { ProjectTypeFinancialApproverResolver } from './project-type-financial-approver.resolver';
import { ProjectTypeFinancialApproverService } from './project-type-financial-approver.service';

@Module({
  providers: [
    ProjectTypeFinancialApproverService,
    ProjectTypeFinancialApproverResolver,
    splitDb(
      ProjectTypeFinancialApproverRepository,
      ProjectTypeFinancialApproverEdgeDBRepository,
    ),
  ],
  exports: [ProjectTypeFinancialApproverService],
})
export class FinancialApproverModule {}
