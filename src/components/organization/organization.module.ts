import { forwardRef, Module } from '@nestjs/common';
import { PostgresModule } from '../../core';
import { AuthorizationModule } from '../authorization/authorization.module';
import { LocationModule } from '../location/location.module';
import { OrganizationRepository } from './organization.repository';
import { OrganizationResolver } from './organization.resolver';
import { OrganizationService } from './organization.service';

@Module({
  imports: [
    forwardRef(() => AuthorizationModule),
    LocationModule,
    PostgresModule,
  ],
  providers: [
    OrganizationResolver,
    OrganizationService,
    OrganizationRepository,
  ],
  exports: [OrganizationService],
})
export class OrganizationModule {}
