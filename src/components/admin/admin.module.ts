import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { UserModule } from '../user/user.module';
import { AdminRepository } from './admin.repository';
import { AdminService } from './admin.service';

@Module({
  imports: [AuthorizationModule, UserModule],
  providers: [AdminService, AdminRepository],
})
export class AdminModule {}
