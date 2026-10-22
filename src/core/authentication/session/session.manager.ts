import { Injectable } from '@nestjs/common';
import { CachedByArg, setOf } from '@seedcompany/common';
import { DateTime } from 'luxon';
import type { Writable } from 'ts-essentials';
import {
  type ID,
  Polls,
  type Role,
  ServerException,
  UnauthenticatedException,
  UnauthorizedException,
} from '~/common';
import { Hooks } from '~/core/hooks';
import { ILogger, Logger } from '~/core/logger';
import { type SystemAgent } from '../../../components/user/dto';
import { SystemAgentRepository } from '../../../components/user/system-agent.repository';
import { Auth0Service } from '../auth0.service';
import { AuthenticationRepository } from '../authentication.repository';
import { CanImpersonateHook } from '../hooks/can-impersonate.hook';
import { JwtService } from '../jwt.service';
import { NoSessionException } from './no-session.exception';
import { Session } from './session.dto';
import { SessionHost } from './session.host';

/**
 * Business logic for session creation/management.
 */
@Injectable()
export class SessionManager {
  constructor(
    private readonly agents: SystemAgentRepository,
    private readonly hooks: Hooks,
    private readonly jwt: JwtService,
    private readonly sessionHost: SessionHost,
    private readonly repo: AuthenticationRepository,
    private readonly auth0: Auth0Service,
    @Logger('session') private readonly logger: ILogger,
  ) {}

  async createToken(): Promise<string> {
    const token = this.jwt.encode();

    await this.repo.saveSessionToken(token);
    return token;
  }

  isAuth0AccessToken(token: string) {
    return this.auth0.isIssuedByAuth0(token);
  }

  /**
   * Resolve an Auth0 access token to a stateless, read-only agent session for
   * the linked Cord user. No `auth_sessions` row exists or is created.
   *
   * Users are matched by `sub` only, never by email and never provisioned: an
   * assistant must not be a way to create or claim an account. A person links
   * their Auth0 identity by signing in to Cord Field once (`loginWithAuth0`).
   */
  async resumeSessionFromAuth0AccessToken(accessToken: string) {
    const claims = await this.auth0.verifyAccessToken(accessToken);

    const user = await this.repo.findUserByAuth0Sub(claims.sub);
    if (!user) {
      this.logger.debug('Access token sub is not linked to a Cord user', {
        sub: claims.sub,
        clientId: claims.clientId,
      });
      throw new UnauthenticatedException(
        'No Cord account is linked to this sign-in. Sign in to Cord Field once first.',
      );
    }
    if (user.status === 'Disabled') {
      throw new UnauthenticatedException('User is disabled');
    }

    return Session.from({
      // Not a stored session; a sentinel so nothing can look this up or log it out.
      token: 'auth0-access-token',
      issuedAt: DateTime.fromSeconds(claims.issuedAt),
      userId: user.id,
      anonymous: false,
      roles: await this.repo.rolesForUser(user.id),
      via: { type: 'oauth', clientId: claims.clientId },
    });
  }

  async refreshCurrentSession() {
    const prev = this.sessionHost.current;
    const newSession = await this.resumeSession(prev.token);
    this.sessionHost.current$.next(newSession);
    return newSession;
  }

  async resumeSession(
    token: string,
    impersonatee?: Session['impersonatee'],
  ): Promise<Session> {
    this.logger.debug('Decoding token', { token });

    const { iat } = this.jwt.decode(token);

    let ghost;
    if (impersonatee?.id?.toLowerCase() === 'ghost') {
      ghost = await this.agents.getGhost();
      impersonatee.id = undefined;
    }

    const [result, anon] = await Promise.all([
      this.repo.resumeSession(token, impersonatee?.id),
      this.agents.getAnonymous(),
    ]);

    if (!result) {
      this.logger.debug('Failed to find active token in database', { token });
      throw new NoSessionException(
        'Session has not been established',
        'NoSession',
      );
    }

    impersonatee =
      impersonatee && result.userId
        ? {
            id: impersonatee.id ?? ghost?.id,
            roles: setOf([
              ...impersonatee.roles,
              ...(result.impersonateeRoles ?? []),
            ]),
          }
        : undefined;

    const requesterSession = Session.from({
      token,
      issuedAt: DateTime.fromMillis(iat),
      userId: result.userId ?? anon.id,
      anonymous: !result.userId,
      // No user resolved -> the userId above is the Anonymous agent's, not a
      // user's. Recorded here so consumers don't have to compare ids to find
      // out; see Session.systemAgentName.
      systemAgentName: result.userId ? undefined : anon.name,
      roles: result.roles,
    });

    const session = impersonatee
      ? requesterSession.with({
          userId: impersonatee.id ?? requesterSession.userId,
          roles: impersonatee.roles,
          // Ghost is the one impersonatee that is an agent rather than a user;
          // undefined otherwise clears the requester's own value (impersonation
          // requires a logged-in requester, so it is always already undefined).
          systemAgentName: ghost?.name,
          impersonator: requesterSession,
          impersonatee,
        })
      : requesterSession;

    if (impersonatee) {
      const allowImpersonationPoll = new Polls.Poll<boolean>();
      await this.sessionHost.withSession(requesterSession, async () => {
        const event = new CanImpersonateHook(
          requesterSession,
          allowImpersonationPoll.ballotBox,
        );
        await this.hooks.run(event);
      });
      const allow = allowImpersonationPoll.close().winner ?? false;
      if (!allow) {
        // Don't expose what the requester is unable to do as this could leak
        // private information.
        throw new UnauthorizedException(
          'You are not authorized to perform this impersonation',
        );
      }
    }

    this.logger.debug('Resumed session', session);
    return session;
  }

  @CachedByArg()
  lazySessionForRootUser(input?: Parameters<Session['with']>[0]) {
    const promiseOfRootId = this.waitForRootUserIdOnce().then((id) => {
      (session as Writable<Session>).userId = id;
      return id;
    });
    const unresolvedId = 'unresolvedId' as ID;
    const session = Session.from({
      token: 'system',
      issuedAt: DateTime.now(),
      userId: unresolvedId,
      anonymous: false,
      roles: ['Administrator'],
      ...input,
    });
    type LazySession = Session &
      Promise<Session> & { withRoles: (...roles: Role[]) => LazySession };
    return new Proxy(session, {
      get: (target: Session, p: string | symbol, receiver: any) => {
        if (p === 'userId' && target.userId === unresolvedId) {
          throw new ServerException(
            'Have not yet connected to database to get root user ID',
          );
        }
        if (p === 'withRoles') {
          return (...roles: Role[]) =>
            this.lazySessionForRootUser({
              roles,
            });
        }
        if (p === 'then') {
          return (...args: any) =>
            promiseOfRootId.then(() => session).then(...args);
        }
        return Reflect.get(target, p, receiver);
      },
    }) as LazySession;
  }

  @CachedByArg()
  private waitForRootUserIdOnce() {
    return this.repo.waitForRootUserId();
  }

  async asUser<R>(
    user: ID<'User'> | Session,
    fn: (session: Session) => Promise<R>,
  ): Promise<R> {
    const session =
      typeof user === 'string' ? await this.sessionForUser(user) : user;
    return await this.sessionHost.withSession(session, () => fn(session));
  }

  /**
   * Run this function as the given system agent, with the agent's roles.
   */
  async asSystemAgent<R>(agent: SystemAgent, fn: () => Promise<R>): Promise<R> {
    const session = Session.from({
      token: 'system',
      issuedAt: DateTime.now(),
      userId: agent.id,
      anonymous: false,
      roles: agent.roles,
      systemAgentName: agent.name,
    });
    return await this.asUser(session, fn);
  }

  asRole<R>(role: Role, fn: () => R): R {
    const session = Session.from({
      token: 'system',
      issuedAt: DateTime.now(),
      userId: 'anonymous' as ID,
      anonymous: false,
      roles: [role],
    });
    return this.sessionHost.withSession(session, fn);
  }

  async sessionForUser(userId: ID): Promise<Session> {
    const roles = await this.repo.rolesForUser(userId);
    const session = Session.from({
      token: 'system',
      issuedAt: DateTime.now(),
      userId,
      anonymous: false,
      roles,
    });
    return session;
  }
}
