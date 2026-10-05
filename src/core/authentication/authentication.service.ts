import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
  AuthenticationException,
  type ID,
  ServerException,
  UnauthenticatedException,
} from '~/common';
import { type Auth0Claims, Auth0Service } from './auth0.service';
import { AuthenticationRepository } from './authentication.repository';
import { type LoginWithAuth0Input } from './dto';
import { SessionHost } from './session/session.host';
import { SessionManager } from './session/session.manager';

/**
 * Service to back the GQL resolvers.
 */
@Injectable()
export class AuthenticationService {
  constructor(
    private readonly repo: AuthenticationRepository,
    private readonly sessionManager: SessionManager,
    private readonly sessionHost: SessionHost,
    private readonly moduleRef: ModuleRef,
    private readonly auth0: Auth0Service,
  ) {}

  /**
   * Login via an Auth0-issued ID token — the only way in. Matches/attaches
   * to an existing session the same way every login method always has.
   *
   * Match order: `sub` (Auth0's stable subject id) first, then email,
   * then JIT-provision a brand-new user if neither matches. A disabled or
   * soft-deleted match is refused: a disabled account gets
   * `UserDisabledException`, a deleted account gets an opaque "Invalid
   * credentials", both to avoid a deleted-account oracle and because
   * `users.email` is uniquely constrained even across deleted rows, so
   * silently provisioning a new user over that email would just fail with a
   * DB constraint error instead.
   *
   * The claimed email is lowercased before any match/store, mirroring the
   * normalization every other email-accepting entry point gets for free via
   * `@EmailField()` — Auth0 is the only path whose email doesn't flow
   * through that GraphQL input decorator (it comes from the verified JWT
   * instead), so this is the one place that invariant has to be enforced
   * explicitly.
   */
  async loginWithAuth0({ idToken }: LoginWithAuth0Input): Promise<ID> {
    const claims = await this.auth0.verifyToken(idToken);
    const email = claims.email.toLowerCase();

    const bySub = await this.repo.findUserByAuth0Sub(claims.sub);
    if (bySub) {
      if (bySub.status === 'Disabled') {
        throw new UserDisabledException();
      }

      const userId = await this.repo.connectSessionToUserId(
        bySub.id,
        this.sessionHost.current,
      );
      if (!userId) {
        throw new ServerException('Login failed');
      }

      await this.sessionManager.refreshCurrentSession();
      return userId;
    }

    const existing = await this.repo.findUserStatusByEmail(email);
    if (existing?.deletedAt) {
      throw new UnauthenticatedException('Invalid credentials');
    }
    if (existing?.status === 'Disabled') {
      throw new UserDisabledException();
    }

    if (!existing) {
      await this.provisionUserFromAuth0({ ...claims, email });
    }

    const userId = await this.repo.connectSessionToUser(
      { email },
      this.sessionHost.current,
    );
    if (!userId) {
      throw new ServerException('Login failed');
    }

    await this.repo.saveAuth0IdentityOnUser(userId, claims.sub);
    await this.sessionManager.refreshCurrentSession();
    return userId;
  }

  private async provisionUserFromAuth0(claims: Auth0Claims): Promise<ID> {
    const userMod = await import('../../components/user');
    const users = this.moduleRef.get(userMod.UserService, { strict: false });
    const nameParts = claims.name?.split(' ') ?? [];
    const given =
      claims.givenName ??
      nameParts[0] ??
      claims.email.split('@')[0] ??
      claims.email;
    const family = claims.familyName ?? (nameParts.slice(1).join(' ') || given);
    const { id } = await users.create({
      email: claims.email,
      realFirstName: given,
      realLastName: family,
      displayFirstName: given,
      displayLastName: family,
    });
    return id;
  }

  async logout(token: string, refresh = true): Promise<void> {
    await this.repo.disconnectUserFromSession(token);
    refresh && (await this.sessionManager.refreshCurrentSession());
  }

  async logoutByUser(user: ID<'User'>) {
    await this.repo.deactivateAllSessions(user);
  }
}

export class UserDisabledException extends AuthenticationException {
  constructor() {
    super('User is disabled');
  }
}
