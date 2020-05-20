import { Module } from '@nestjs/common';
import { LocationModule } from '../location';
import { OrganizationModule } from '../organization';
import { PartnershipModule } from '../partnership';
import { ProjectModule } from '../project';
import { EducationModule, UnavailabilityModule, UserModule } from '../user';
import { BudgetRecordResolver } from './budget-record.resolver';
import { BudgetResolver } from './budget.resolver';
import { BudgetService } from './budget.service';

@Module({
  imports: [
    PartnershipModule,
    ProjectModule,
    EducationModule,
    LocationModule,
    OrganizationModule,
    UnavailabilityModule,
    UserModule,
  ],
  providers: [BudgetResolver, BudgetRecordResolver, BudgetService],
  exports: [BudgetService],
})
export class BudgetModule {}
