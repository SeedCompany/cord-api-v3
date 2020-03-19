import { Module } from '@nestjs/common';
import { BudgetResolver } from './budget.resolver';
import { BudgetService } from './budget.service';

@Module({
  providers: [BudgetResolver, BudgetService],
  exports: [BudgetService],
})
export class BudgetModule {}
