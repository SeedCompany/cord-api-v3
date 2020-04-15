import { Module } from '@nestjs/common';
import { LocationService } from '../location';
import { OrganizationService } from '../organization';
import { PartnershipModule } from '../partnership/partnership.module';
import { ProjectModule } from '../project/project.module';
import { ProjectService } from '../project/project.service';
import { EducationService, UnavailabilityService, UserService } from '../user';
import { BudgetResolver } from './budget.resolver';
import { BudgetService } from './budget.service';

@Module({
  imports: [PartnershipModule, ProjectModule],
  providers: [
    BudgetResolver,
    BudgetService,
    EducationService,
    LocationService,
    OrganizationService,
    ProjectService,
    UnavailabilityService,
    UserService,
  ],
  exports: [BudgetService],
})
export class BudgetModule {}
