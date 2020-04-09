import { Module } from '@nestjs/common';
import { AuthorizationResolver } from './authorization.resolver';
import { AuthorizationService } from './authorization.service';

@Module({
  providers: [AuthorizationService, AuthorizationResolver],
  exports: [AuthorizationService],
})
export class AuthorizationModule {}
