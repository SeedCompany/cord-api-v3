import { Module } from '@nestjs/common';
import { OrganizationModule } from '../organization/organization.module';
import { AdminResolver } from './admin.resolver';
import { AdminService } from './admin.service';

@Module({
  imports: [OrganizationModule],
  providers: [AdminService, AdminResolver],
  exports: [AdminService],
})
export class AdminModule {}
