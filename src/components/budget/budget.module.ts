import { Module } from '@nestjs/common';
import { ProjectModule } from '../project/project.module';
import { ProjectService } from '../project/project.service';
import { BudgetResolver } from './budget.resolver';
import { BudgetService } from './budget.service';

@Module({
  imports: [ProjectModule],
  providers: [BudgetResolver, BudgetService, ProjectService],
  exports: [BudgetService],
})
export class BudgetModule {}
