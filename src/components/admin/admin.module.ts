import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization';
import { UserModule } from '../user';
import { AdminResolver } from './admin.resolver';
import { AdminService } from './admin.service';

@Module({
  imports: [UserModule, AuthorizationModule],
  providers: [AdminService, AdminResolver],
  exports: [AdminService],
})
export class AdminModule {}
