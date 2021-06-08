import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { AdminRepository } from './admin.repository';
import { AdminService } from './admin.service';

@Module({
  imports: [AuthorizationModule],
  providers: [AdminService, AdminRepository],
  exports: [AdminService],
})
export class AdminModule {}
