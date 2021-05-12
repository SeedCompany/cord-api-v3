import { forwardRef, Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { LocationModule } from '../location/location.module';
import { OrganizationResolver } from './organization.resolver';
import { OrganizationService } from './organization.service';

import { OrganizationRepository } from './organization.repository';

@Module({
  imports: [forwardRef(() => AuthorizationModule), LocationModule],
  providers: [
    OrganizationResolver,
    OrganizationService,
    OrganizationRepository,
  ],
  exports: [OrganizationService, OrganizationRepository],
})
export class OrganizationModule {}
