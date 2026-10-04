import { Injectable } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { UnauthenticatedException } from '~/common';
import { ConfigService } from '~/core/config';
import { ILogger, Logger } from '~/core/logger';

export interface Auth0Claims {
  readonly sub: string;
  readonly email: string;
  readonly emailVerified: boolean;
  readonly givenName?: string;
  readonly familyName?: string;
  readonly name?: string;
}

/**
 * Verifies an Auth0-issued ID token (RS256) against the tenant's JWKS.
 *
 * `verifyToken` is the one seam tests stub out — it's kept to a simple
 * token-in/claims-out signature so `jest.spyOn(app.get(Auth0Service),
 * 'verifyToken')` can replace real network/crypto with a fixture.
 */
@Injectable()
export class Auth0Service {
  private jwks: JWTVerifyGetKey | undefined;

  constructor(
    private readonly config: ConfigService,
    @Logger('authentication:auth0') private readonly logger: ILogger,
  ) {}

  async verifyToken(idToken: string): Promise<Auth0Claims> {
    const { domain, audience } = this.config.auth0;
    if (!domain || !audience) {
      this.logger.warning(
        'Rejecting Auth0 login; AUTH0_DOMAIN/AUTH0_AUDIENCE are not configured',
      );
      throw new UnauthenticatedException('Auth0 login is not configured');
    }

    try {
      const { payload } = await jwtVerify(idToken, this.jwksFor(domain), {
        issuer: `https://${domain}/`,
        audience,
      });

      if (!payload.sub) {
        throw new Error('ID token is missing a sub claim');
      }
      if (typeof payload.email !== 'string' || !payload.email) {
        throw new Error('ID token is missing an email claim');
      }

      return {
        sub: payload.sub,
        email: payload.email,
        emailVerified: payload.email_verified === true,
        givenName: asOptionalString(payload.given_name),
        familyName: asOptionalString(payload.family_name),
        name: asOptionalString(payload.name),
      };
    } catch (exception) {
      this.logger.warning('Failed to verify Auth0 ID token', { exception });
      throw new UnauthenticatedException(
        'Invalid Auth0 token',
        exception instanceof Error ? exception : undefined,
      );
    }
  }

  /** Lazily built & cached — handles JWKS fetch/cache/rotation for us. */
  private jwksFor(domain: string): JWTVerifyGetKey {
    this.jwks ??= createRemoteJWKSet(
      new URL(`https://${domain}/.well-known/jwks.json`),
    );
    return this.jwks;
  }
}

const asOptionalString = (value: unknown): string | undefined =>
  typeof value === 'string' && value ? value : undefined;
