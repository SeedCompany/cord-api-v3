import { forwardRef, Module } from '@nestjs/common';
import { splitDb } from '../../core';
import { AuthorizationModule } from '../authorization/authorization.module';
import { LocationModule } from '../location/location.module';
import { OrganizationLoader } from './organization.loader';
import { PgOrganizationRepository } from './organization.pg.repository';
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
    splitDb(OrganizationRepository, PgOrganizationRepository),
  ],
  exports: [OrganizationService],
})
export class OrganizationModule {}
