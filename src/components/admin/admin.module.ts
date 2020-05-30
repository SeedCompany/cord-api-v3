import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization';
import { UserModule } from '../user';
import { AdminResolver } from './admin.resolver';
import { AdminService } from './admin.service';
import { QueryModule } from '../../core/query/query.module';

@Module({
  imports: [UserModule, AuthorizationModule, QueryModule],
  providers: [AdminService, AdminResolver],
  exports: [AdminService],
})
export class AdminModule {}
