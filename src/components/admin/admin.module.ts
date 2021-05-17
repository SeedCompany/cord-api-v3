import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { OrganizationModule } from '../organization/organization.module';
import { AdminRepository } from './admin.repository';
import { AdminResolver } from './admin.resolver';
import { AdminService } from './admin.service';

@Module({
  imports: [OrganizationModule, AuthorizationModule],
  providers: [AdminService, AdminResolver, AdminRepository],
  exports: [AdminService, AdminRepository],
})
export class AdminModule {}
