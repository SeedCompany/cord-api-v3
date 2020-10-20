import { Module } from '@nestjs/common';
import { AuthorizationService } from '../authorization/authorization.service';
import { AuthorizationResolver } from './authorization.resolver';

@Module({
  imports: [],
  providers: [AuthorizationResolver, AuthorizationService],
  exports: [AuthorizationService],
})
export class AuthorizationModule {}
