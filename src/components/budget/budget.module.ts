import { forwardRef, Module } from '@nestjs/common';
import { splitDb } from '../../core';
import { AuthorizationModule } from '../authorization/authorization.module';
import { FileModule } from '../file/file.module';
import { LocationModule } from '../location/location.module';
import { OrganizationModule } from '../organization/organization.module';
import { PartnershipModule } from '../partnership/partnership.module';
import { ProjectModule } from '../project/project.module';
import { EducationModule } from '../user/education/education.module';
import { UnavailabilityModule } from '../user/unavailability/unavailability.module';
import { UserModule } from '../user/user.module';
import { PgBudgetRecordRepository } from './budget-record.pg.repository';
import { BudgetRecordRepository } from './budget-record.repository';
import { BudgetRecordResolver } from './budget-record.resolver';
import { BudgetLoader } from './budget.loader';
import { PgBudgetRepository } from './budget.pg.repository';
import { BudgetRepository } from './budget.repository';
import { BudgetResolver } from './budget.resolver';
import { BudgetService } from './budget.service';
import * as handlers from './handlers';

@Module({
  imports: [
    FileModule,
    forwardRef(() => AuthorizationModule),
    EducationModule,
    forwardRef(() => LocationModule),
    forwardRef(() => PartnershipModule),
    forwardRef(() => OrganizationModule),
    forwardRef(() => ProjectModule),
    UnavailabilityModule,
    forwardRef(() => UserModule),
  ],
  providers: [
    BudgetResolver,
    BudgetRecordResolver,
    BudgetService,
    splitDb(BudgetRepository, PgBudgetRepository),
    splitDb(BudgetRecordRepository, PgBudgetRecordRepository),
    BudgetLoader,
    ...Object.values(handlers),
  ],
  exports: [BudgetService],
})
export class BudgetModule {}
