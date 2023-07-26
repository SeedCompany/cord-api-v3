import { forwardRef, Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { LocationModule } from '../location/location.module';
import { AddOrganizationAcronymMigration } from './migrations/add-acronym.migration';
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
    AddOrganizationAcronymMigration,
  ],
  exports: [OrganizationService],
})
export class OrganizationModule {}
