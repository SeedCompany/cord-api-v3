import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization';
import { UserModule } from '../user';
import { AdminResolver } from './admin.resolver';
import { AdminService } from './admin.service';
import { OrganizationModule } from '../organization';

@Module({
  imports: [UserModule, AuthorizationModule, OrganizationModule],
  providers: [AdminService, AdminResolver],
  exports: [AdminService],
})
export class AdminModule {}
