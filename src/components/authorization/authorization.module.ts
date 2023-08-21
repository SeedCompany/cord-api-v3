import { Global, Module } from '@nestjs/common';
import { AssignableRolesGranter } from './assignable-roles.granter';
import { AuthorizationResolver } from './authorization.resolver';
import { BetaFeaturesGranter } from './dto/beta-features';
import * as Policies from './policies';
import { PolicyModule } from './policy/policy.module';

@Global()
@Module({
  imports: [PolicyModule],
  providers: [
    AuthorizationResolver,
    ...Object.values(Policies),
    AssignableRolesGranter,
    BetaFeaturesGranter,
  ],
  exports: [PolicyModule],
})
export class AuthorizationModule {}
