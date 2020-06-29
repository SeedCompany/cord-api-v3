import { Module } from '@nestjs/common';
import { BudgetModule } from '../budget/budget.module';
import { FileModule } from '../file/file.module';
import { PartnershipResolver } from './partnership.resolver';
import { PartnershipService } from './partnership.service';

@Module({
  imports: [FileModule, BudgetModule],
  providers: [PartnershipResolver, PartnershipService],
  exports: [PartnershipService],
})
export class PartnershipModule {}
