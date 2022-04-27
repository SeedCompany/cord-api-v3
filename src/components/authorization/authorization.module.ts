import { Module } from '@nestjs/common';
import { AuthorizationService } from '../authorization/authorization.service';
import { AuthorizationRepository } from './authorization.repository';
import { AuthorizationResolver } from './authorization.resolver';
import * as migrations from './migrations';

@Module({
  imports: [],
  providers: [
    AuthorizationResolver,
    AuthorizationService,
    AuthorizationRepository,
    ...Object.values(migrations),
  ],
  exports: [AuthorizationService],
})
export class AuthorizationModule {}
