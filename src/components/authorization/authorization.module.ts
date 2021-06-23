import { Module } from '@nestjs/common';
import { AuthorizationService } from '../authorization/authorization.service';
import { AuthorizationRepository } from './authorization.repository';
import { AuthorizationResolver } from './authorization.resolver';

@Module({
  imports: [],
  providers: [
    AuthorizationResolver,
    AuthorizationService,
    AuthorizationRepository,
  ],
  exports: [AuthorizationService],
})
export class AuthorizationModule {}
