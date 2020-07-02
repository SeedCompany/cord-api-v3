import { forwardRef, Module } from '@nestjs/common';
import { LocationModule } from '../location/location.module';
import { OrganizationModule } from '../organization/organization.module';
import { PartnershipModule } from '../partnership/partnership.module';
import { EducationModule } from '../user/education/education.module';
import { UnavailabilityModule } from '../user/unavailability/unavailability.module';
import { UserModule } from '../user/user.module';
import { BudgetRecordResolver } from './budget-record.resolver';
import { BudgetResolver } from './budget.resolver';
import { BudgetService } from './budget.service';
import * as handlers from './handlers';

@Module({
  imports: [
    EducationModule,
    LocationModule,
    forwardRef(() => PartnershipModule),
    forwardRef(() => OrganizationModule),
    UnavailabilityModule,
    UserModule,
  ],
  providers: [
    BudgetResolver,
    BudgetRecordResolver,
    BudgetService,
    ...Object.values(handlers),
  ],
  exports: [BudgetService],
})
export class BudgetModule {}
