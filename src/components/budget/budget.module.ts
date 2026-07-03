import { forwardRef, Module } from '@nestjs/common';
import { splitDb } from '~/core/database';
import { AuthorizationModule } from '../authorization/authorization.module';
import { FileModule } from '../file/file.module';
import { LocationModule } from '../location/location.module';
import { OrganizationModule } from '../organization/organization.module';
import { PartnershipModule } from '../partnership/partnership.module';
import { ProjectModule } from '../project/project.module';
import { EducationModule } from '../user/education/education.module';
import { UnavailabilityModule } from '../user/unavailability/unavailability.module';
import { UserModule } from '../user/user.module';
import { BudgetRecordDrizzleRepository } from './budget-record.drizzle.repository';
import { BudgetRecordLoader } from './budget-record.loader';
import { BudgetRecordRepository } from './budget-record.repository';
import { BudgetRecordResolver } from './budget-record.resolver';
import { BudgetDrizzleRepository } from './budget.drizzle.repository';
import { BudgetLoader } from './budget.loader';
import { BudgetRepository } from './budget.repository';
import { BudgetResolver } from './budget.resolver';
import { BudgetService } from './budget.service';
import * as handlers from './handlers';
import { MigrateInitialAmountMigration } from './migrations/migrate-adjusted-amount.migration';

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
    splitDb(BudgetRepository, {
      // migration-todo: `as any` removed at Phase 7 cutover when splitDb
      // disappears with the Neo4j path.
      postgres: BudgetDrizzleRepository as any,
    }),
    splitDb(BudgetRecordRepository, {
      // migration-todo: same as above.
      postgres: BudgetRecordDrizzleRepository as any,
    }),
    BudgetLoader,
    BudgetRecordLoader,
    MigrateInitialAmountMigration,
    ...Object.values(handlers),
  ],
  exports: [BudgetService],
})
export class BudgetModule {}
