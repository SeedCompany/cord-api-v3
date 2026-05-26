import { forwardRef, Module } from '@nestjs/common';
import { splitDb } from '~/core/database';
import { AuthorizationModule } from '../authorization/authorization.module';
import { LocationModule } from '../location/location.module';
import { AddOrganizationReachMigration } from './migrations/add-reach.migration';
import { AddOrganizationTypeMigration } from './migrations/add-type.migration';
import { OrganizationDrizzleRepository } from './organization.drizzle.repository';
import { OrganizationGelRepository } from './organization.gel.repository';
import { OrganizationLoader } from './organization.loader';
import { OrganizationRepository } from './organization.repository';
import { OrganizationResolver } from './organization.resolver';
import { OrganizationService } from './organization.service';

@Module({
  imports: [
    forwardRef(() => AuthorizationModule),
    forwardRef(() => LocationModule),
  ],
  providers: [
    OrganizationResolver,
    OrganizationService,
    splitDb(OrganizationRepository, {
      gel: OrganizationGelRepository,
      // migration-todo: remove `as any` once splitDb types accept drizzle repos directly
      postgres: OrganizationDrizzleRepository as any,
    }),
    OrganizationLoader,
    AddOrganizationReachMigration,
    AddOrganizationTypeMigration,
  ],
  exports: [OrganizationService],
})
export class OrganizationModule {}
