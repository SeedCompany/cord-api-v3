import { Query, ResolveField, Resolver, type ResolverTypeFn } from '@nestjs/graphql';
import { mapValues } from '@seedcompany/common';
import { EnhancedResource } from '~/common';
import { LoginOutput, RegisterOutput, SessionOutput } from '~/core/authentication/dto';
import { Power } from './dto';
import { BetaFeatures } from './dto/beta-features.dto';
import { Privileges } from './policy';

@Resolver()
export class AuthorizationResolver {
  constructor(private readonly privileges: Privileges) {}

  @Query(() => [Power])
  powers(): Power[] {
    return [...this.privileges.powers];
  }
}

function AuthExtraInfoResolver(concreteClass: ResolverTypeFn) {
  @Resolver(concreteClass)
  class ExtraInfoResolver {
    constructor(private readonly privileges: Privileges) {}

    @ResolveField(() => [Power])
    powers(): Power[] {
      return [...this.privileges.powers];
    }

    @ResolveField(() => BetaFeatures)
    betaFeatures(): BetaFeatures {
      const privileges = this.privileges.for(BetaFeatures);
      const { props } = EnhancedResource.of(BetaFeatures);
      return mapValues.fromList([...props], (prop) => privileges.can('edit', prop)).asRecord;
    }
  }
  return ExtraInfoResolver;
}

export class SessionExtraInfoResolver extends AuthExtraInfoResolver(() => SessionOutput) {}

export class LoginExtraInfoResolver extends AuthExtraInfoResolver(() => LoginOutput) {}

export class RegisterExtraInfoResolver extends AuthExtraInfoResolver(() => RegisterOutput) {}
