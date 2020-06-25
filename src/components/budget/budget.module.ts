import { forwardRef, Module } from '@nestjs/common';
import { LocationModule } from '../location';
import { OrganizationModule } from '../organization/organization.module';
import { PartnershipModule } from '../partnership/partnership.module';
import { BudgetRecordResolver } from './budget-record.resolver';
import { BudgetResolver } from './budget.resolver';
import { BudgetService } from './budget.service';

@Module({
  imports: [
    LocationModule,
    forwardRef(() => PartnershipModule),
    forwardRef(() => OrganizationModule),
  ],
  providers: [BudgetResolver, BudgetRecordResolver, BudgetService],
  exports: [BudgetService],
})
export class BudgetModule {}
