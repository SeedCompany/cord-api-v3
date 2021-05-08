import { Module } from '@nestjs/common';
import { AuthorizationService } from '../authorization/authorization.service';
import { AuthorizationResolver } from './authorization.resolver';
import { AuthorizationRepository } from './authorization.repository';

@Module({
  imports: [],
  providers: [
    AuthorizationResolver,
    AuthorizationService,
    AuthorizationRepository,
  ],
  exports: [AuthorizationService, AuthorizationRepository],
})
export class AuthorizationModule {}
