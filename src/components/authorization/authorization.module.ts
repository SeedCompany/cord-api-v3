import { Global, Module } from '@nestjs/common';
import { AssignableRolesGranter } from './assignable-roles.granter';
import {
  AuthorizationResolver,
  LoginExtraInfoResolver,
  RegisterExtraInfoResolver,
  SessionExtraInfoResolver,
} from './authorization.resolver';
import { BetaFeaturesGranter } from './dto/beta-features.dto';
import * as Policies from './policies';
import { PolicyModule } from './policy/policy.module';

@Global()
@Module({
  imports: [PolicyModule],
  providers: [
    AuthorizationResolver,
    LoginExtraInfoResolver,
    RegisterExtraInfoResolver,
    SessionExtraInfoResolver,
    ...Object.values(Policies),
    AssignableRolesGranter,
    BetaFeaturesGranter,
  ],
  exports: [PolicyModule],
})
export class AuthorizationModule {}
