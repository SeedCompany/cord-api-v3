import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { AdminService } from './admin.service';

@Module({
  imports: [AuthorizationModule],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
