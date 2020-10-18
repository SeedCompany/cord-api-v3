import { forwardRef, Module } from '@nestjs/common';
import { AuthenticationModule } from '../authentication/authentication.module';
import { OrganizationModule } from '../organization/organization.module';
import { AdminResolver } from './admin.resolver';
import { AdminService } from './admin.service';

@Module({
  imports: [forwardRef(() => AuthenticationModule), OrganizationModule],
  providers: [AdminService, AdminResolver],
  exports: [AdminService],
})
export class AdminModule {}
