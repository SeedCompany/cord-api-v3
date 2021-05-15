import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { OrganizationModule } from '../organization/organization.module';
import { AdminResolver } from './admin.resolver';
import { AdminService } from './admin.service';
import { AdminRepository } from './admin.repository';

@Module({
  imports: [OrganizationModule, AuthorizationModule],
  providers: [AdminService, AdminResolver, AdminRepository],
  exports: [AdminService, AdminRepository],
})
export class AdminModule {}
