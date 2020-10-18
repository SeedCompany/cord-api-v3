import { forwardRef, Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { FileModule } from '../file/file.module';
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
    FileModule,
    forwardRef(() => AuthorizationModule),
    EducationModule,
    LocationModule,
    forwardRef(() => PartnershipModule),
    forwardRef(() => OrganizationModule),
    UnavailabilityModule,
    forwardRef(() => UserModule),
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
