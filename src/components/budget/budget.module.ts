import { forwardRef, Module } from '@nestjs/common';
import { splitDb } from '~/core/database';
import { AuthorizationModule } from '../authorization/authorization.module';
import { EngagementModule } from '../engagement/engagement.module';
import { FileModule } from '../file/file.module';
import { LocationModule } from '../location/location.module';
import { OrganizationModule } from '../organization/organization.module';
import { PartnerModule } from '../partner/partner.module';
import { PartnershipModule } from '../partnership/partnership.module';
import { ProjectModule } from '../project/project.module';
import { EducationModule } from '../user/education/education.module';
import { UnavailabilityModule } from '../user/unavailability/unavailability.module';
import { UserModule } from '../user/user.module';
import { BudgetCalculationService } from './budget-calculation.service';
import { BudgetDerivedFieldsService } from './budget-derived-fields.service';
import { BudgetLineItemLoader } from './budget-line-item.loader';
import { BudgetLineItemRepository } from './budget-line-item.repository';
import { BudgetLineItemResolver } from './budget-line-item.resolver';
import { BudgetLineItemService } from './budget-line-item.service';
import { BudgetRecordDrizzleRepository } from './budget-record.drizzle.repository';
import { BudgetRecordLoader } from './budget-record.loader';
import { BudgetRecordRepository } from './budget-record.repository';
import { BudgetRecordResolver } from './budget-record.resolver';
import { BudgetReferenceCountryLoader } from './budget-reference-country.loader';
import { BudgetReferenceCountryRepository } from './budget-reference-country.repository';
import { BudgetReferenceCountryResolver } from './budget-reference-country.resolver';
import { BudgetReferenceKeystoneRateRepository } from './budget-reference-keystone-rate.repository';
import { BudgetDrizzleRepository } from './budget.drizzle.repository';
import { BudgetLoader } from './budget.loader';
import { BudgetRepository } from './budget.repository';
import { BudgetResolver } from './budget.resolver';
import { BudgetService } from './budget.service';
import * as handlers from './handlers';
import { MigrateInitialAmountMigration } from './migrations/migrate-adjusted-amount.migration';
import { OtherPartnerContributionLoader } from './other-partner-contribution.loader';
import { OtherPartnerContributionRepository } from './other-partner-contribution.repository';
import { OtherPartnerContributionResolver } from './other-partner-contribution.resolver';
import { OtherPartnerContributionService } from './other-partner-contribution.service';
import { SyncLineItemsToBudgetRecordsService } from './sync-line-items-to-budget-records.service';

@Module({
  imports: [
    FileModule,
    forwardRef(() => AuthorizationModule),
    EducationModule,
    forwardRef(() => LocationModule),
    forwardRef(() => PartnershipModule),
    forwardRef(() => PartnerModule),
    forwardRef(() => OrganizationModule),
    forwardRef(() => ProjectModule),
    forwardRef(() => EngagementModule),
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
    // ── budget-line-items-poc additions ──
    // No `splitDb(...)` wrapping below: these are brand-new resources with no
    // Neo4j/Gel counterpart to split against (unlike everything above), so
    // each is registered as a single, direct provider.
    BudgetCalculationService,
    BudgetLineItemResolver,
    BudgetLineItemService,
    BudgetLineItemRepository,
    BudgetLineItemLoader,
    OtherPartnerContributionResolver,
    OtherPartnerContributionService,
    OtherPartnerContributionRepository,
    OtherPartnerContributionLoader,
    BudgetReferenceCountryResolver,
    BudgetReferenceCountryRepository,
    BudgetReferenceCountryLoader,
    // ── budget-line-items-poc phase 3 additions ──
    BudgetDerivedFieldsService,
    BudgetReferenceKeystoneRateRepository,
    SyncLineItemsToBudgetRecordsService,
  ],
  exports: [BudgetService],
})
export class BudgetModule {}
