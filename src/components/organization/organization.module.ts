import { forwardRef, Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { LocationModule } from '../location/location.module';
import { AddOrganizationReachMigration } from './migrations/add-reach.migration';
import { AddOrganizationTypeMigration } from './migrations/add-type.migration';
import { OrganizationLoader } from './organization.loader';
import { OrganizationRepository } from './organization.repository';
import { OrganizationResolver } from './organization.resolver';
import { OrganizationService } from './organization.service';

@Module({
  imports: [forwardRef(() => AuthorizationModule), LocationModule],
  providers: [
    OrganizationResolver,
    OrganizationService,
    OrganizationRepository,
    OrganizationLoader,
    AddOrganizationReachMigration,
    AddOrganizationTypeMigration,
  ],
  exports: [OrganizationService],
})
export class OrganizationModule {}
