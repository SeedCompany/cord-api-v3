import { Module } from '@nestjs/common';
import { AuthorizationRepository } from './authorization.repository';
import { AuthorizationResolver } from './authorization.resolver';
import { AuthorizationService } from './authorization.service';
import * as migrations from './migrations';
import * as Policies from './policies';
import { PolicyModule } from './policy/policy.module';

@Module({
  imports: [PolicyModule],
  providers: [
    AuthorizationResolver,
    AuthorizationService,
    AuthorizationRepository,
    ...Object.values(Policies),
    ...Object.values(migrations),
  ],
  exports: [AuthorizationService, PolicyModule],
})
export class AuthorizationModule {}
