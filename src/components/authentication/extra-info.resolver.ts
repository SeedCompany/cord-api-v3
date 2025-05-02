import { ResolveField, Resolver } from '@nestjs/graphql';
import { mapValues } from '@seedcompany/common';
import { type AbstractClassType, AnonSession, type Session } from '~/common';
import { Privileges } from '../authorization';
import { BetaFeatures } from '../authorization/dto/beta-features';
import { LoginOutput, RegisterOutput, SessionOutput } from './dto';

function AuthExtraInfoResolver(concreteClass: AbstractClassType<any>) {
  @Resolver(concreteClass)
  class ExtraInfoResolver {
    constructor(private readonly privileges: Privileges) {}

    @ResolveField(() => BetaFeatures)
    betaFeatures(@AnonSession() session: Session): BetaFeatures {
      const privileges = this.privileges.for(session, BetaFeatures);
      return mapValues.fromList(BetaFeatures.Props, (prop) =>
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
