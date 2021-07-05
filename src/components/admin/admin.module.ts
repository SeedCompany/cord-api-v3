import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { AdminRepository } from './admin.repository';
import { AdminResolver } from './admin.resolver';
import { AdminService } from './admin.service';

@Module({
  imports: [AuthorizationModule],
  providers: [AdminResolver, AdminService, AdminRepository],
  exports: [AdminService],
})
export class AdminModule {}
