import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization';
import { OrganizationModule } from '../organization';
import { UserModule } from '../user';
import { AdminResolver } from './admin.resolver';
import { AdminService } from './admin.service';

@Module({
  imports: [UserModule, AuthorizationModule, OrganizationModule],
  providers: [AdminService, AdminResolver],
  exports: [AdminService],
})
export class AdminModule {}
