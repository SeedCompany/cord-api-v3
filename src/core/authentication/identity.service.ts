import { Inject, Injectable } from '@nestjs/common';
import type { ID, Role } from '~/common';
import { type AuthenticationService } from '../../components/authentication';
import { SessionHost } from '../../components/authentication/session.host';

/**
 * A facade for authentication functionality that is public to the codebase.
 */
@Injectable()
export class Identity {
  constructor(
    @Inject('AUTHENTICATION')
    private readonly auth: AuthenticationService & {},
    private readonly sessionHost: SessionHost,
  ) {}

  get current() {
    return this.sessionHost.current;
  }

  get currentMaybe() {
    return this.sessionHost.currentMaybe;
  }

  get currentIfInCtx() {
    return this.sessionHost.currentIfInCtx;
  }

  /**
   * Is the current user an admin?
   *
   * Not the best API, use is discouraged.
   * Prefer using Auth Policies / {@link Privileges}`.for.can()`
   */
  get isAdmin() {
    return this.current.roles.includes('global:Administrator');
  }

  /**
   * Is the current user (or impersonator) an admin?
   * This ignores impersonation.
   *
   * Not the best API, use is discouraged.
   * Prefer using Auth Policies / {@link Privileges}`.for.can()`
   */
  get isImpersonatorAdmin() {
    const session = this.current;
    return (session.impersonator ?? session).roles.includes(
      'global:Administrator',
    );
  }

  /**
   * Is this the ID of the current user?
   *
   * Not the best API, use is discouraged.
   * Prefer using Auth Policies / {@link Privileges}`.for.can()`
   */
  isSelf(id: ID<'User'>) {
    return id === this.current.userId;
  }

  async asUser<R>(user: ID<'User'>, fn: () => Promise<R>): Promise<R> {
    return await this.auth.asUser(user, fn);
  }

  /**
   * Run this function with the current user as an ephemeral one this role
   */
  asRole<R>(role: Role, fn: () => R): R {
    return this.auth.asRole(role, fn);
  }

  /**
   * @deprecated probably replace this with something more explicit.
   */
  async readyForCli() {
    // Ensure the default root session is ready to go for data loaders
    await this.auth.lazySessionForRootUser();
  }
}
