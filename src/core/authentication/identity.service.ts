import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { type ID, type Role, UnauthenticatedException } from '~/common';
import { type IRequest } from '../http/types';
import { SessionHost } from './session/session.host';
import type { SessionInitiator } from './session/session.initiator';
import type { SessionManager } from './session/session.manager';

/**
 * A facade for authentication functionality that is public to the codebase.
 */
@Injectable()
export class Identity {
  constructor(
    @Inject(forwardRef(() => 'SessionManager'))
    private readonly sessionManager: SessionManager & {},
    @Inject(forwardRef(() => 'SessionInitiator'))
    private readonly sessionInitiator: SessionInitiator & {},
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
   * Is the current requestor anonymous (not logged in)?
   *
   * Not the best API, use is discouraged.
   * Prefer using Auth Policies / {@link Privileges}`.for.can()`
   */
  get isAnonymous() {
    return this.current.anonymous;
  }

  /**
   * Manually verify the current requestor is logged in.
   */
  verifyLoggedIn(session?: Identity['current']) {
    if ((session ?? this.current).anonymous) {
      throw new UnauthenticatedException('User is not logged in');
    }
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
    return await this.sessionManager.asUser(user, fn);
  }

  /**
   * Run this function with the current user as an ephemeral one this role
   */
  asRole<R>(role: Role, fn: () => R): R {
    return this.sessionManager.asRole(role, fn);
  }

  async identifyRequest(request: IRequest) {
    return await this.sessionInitiator.resume(request);
  }

  /**
   * @deprecated probably replace this with something more explicit.
   */
  async readyForCli() {
    // Ensure the default root session is ready to go for data loaders
    await this.sessionManager.lazySessionForRootUser();
  }
}
