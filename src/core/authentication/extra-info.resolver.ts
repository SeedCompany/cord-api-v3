import { ResolveField, Resolver } from '@nestjs/graphql';
import { mapValues } from '@seedcompany/common';
import { type AbstractClassType, EnhancedResource } from '~/common';
import { Privileges } from '../../components/authorization';
import { BetaFeatures } from '../../components/authorization/dto/beta-features.dto';
import { LoginOutput, RegisterOutput, SessionOutput } from './dto';

function AuthExtraInfoResolver(concreteClass: AbstractClassType<any>) {
  @Resolver(concreteClass)
  class ExtraInfoResolver {
    constructor(private readonly privileges: Privileges) {}

    @ResolveField(() => BetaFeatures)
    betaFeatures(): BetaFeatures {
      const privileges = this.privileges.for(BetaFeatures);
      const { props } = EnhancedResource.of(BetaFeatures);
      return mapValues.fromList([...props], (prop) =>
        privileges.can('edit', prop),
      ).asRecord;
    }
  }
  return ExtraInfoResolver;
}

export class SessionExtraInfoResolver extends AuthExtraInfoResolver(
  SessionOutput,
) {}

export class LoginExtraInfoResolver extends AuthExtraInfoResolver(
  LoginOutput,
) {}

export class RegisterExtraInfoResolver extends AuthExtraInfoResolver(
  RegisterOutput,
) {}
