import { Global, Module } from '@nestjs/common';
import { AuthorizationResolver } from './authorization.resolver';
import { AuthorizationService } from './authorization.service';
import { BetaFeaturesGranter } from './dto/beta-features';
import * as migrations from './migrations';
import * as Policies from './policies';
import { PolicyModule } from './policy/policy.module';

@Global()
@Module({
  imports: [PolicyModule],
  providers: [
    AuthorizationResolver,
    AuthorizationService,
    ...Object.values(Policies),
    ...Object.values(migrations),
    BetaFeaturesGranter,
  ],
  exports: [AuthorizationService, PolicyModule],
})
export class AuthorizationModule {}
