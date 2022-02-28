import { forwardRef, Module } from '@nestjs/common';
import { splitDb } from '../../core';
import { AuthorizationModule } from '../authorization/authorization.module';
import { LocationModule } from '../location/location.module';
import { OrganizationLoader } from './organization.loader';
import {
  OrganizationRepository,
  PgOrganizationRepository,
} from './organization.repository';
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
    PgOrganizationRepository,
  ],
  exports: [OrganizationService],
})
export class OrganizationModule {}
