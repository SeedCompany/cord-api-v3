import { Module } from '@nestjs/common';
import { LocationModule } from '../location';
import { OrganizationModule } from '../organization';
import { PartnershipModule } from '../partnership/partnership.module';
import { ProjectModule } from '../project/project.module';
import { EducationModule, UnavailabilityModule, UserModule } from '../user';
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
  providers: [BudgetResolver, BudgetService],
  exports: [BudgetService],
})
export class BudgetModule {}
