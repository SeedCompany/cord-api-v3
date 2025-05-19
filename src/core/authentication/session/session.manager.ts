import { Injectable } from '@nestjs/common';
import { CachedByArg } from '@seedcompany/common';
import { DateTime } from 'luxon';
import type { Writable } from 'ts-essentials';
import {
  type ID,
  Poll,
  type Role,
  ServerException,
  type Session,
  UnauthorizedException,
} from '~/common';
import { IEventBus } from '~/core/events';
import { ILogger, Logger } from '~/core/logger';
import { rolesForScope } from '../../../components/authorization/dto';
import { SystemAgentRepository } from '../../../components/user/system-agent.repository';
import { AuthenticationRepository } from '../authentication.repository';
import { CanImpersonateEvent } from '../events/can-impersonate.event';
import { JwtService } from '../jwt.service';
import { NoSessionException } from './no-session.exception';
import { SessionHost } from './session.host';

/**
 * Business logic for session creation/management.
 */
@Injectable()
export class SessionManager {
  constructor(
    private readonly agents: SystemAgentRepository,
    private readonly events: IEventBus,
    private readonly jwt: JwtService,
    private readonly sessionHost: SessionHost,
    private readonly repo: AuthenticationRepository,
    @Logger('session') private readonly logger: ILogger,
  ) {}

  async createToken(): Promise<string> {
    const token = this.jwt.encode();

    await this.repo.saveSessionToken(token);
    return token;
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
            id: impersonatee?.id ?? ghost?.id,
            roles: [
              ...(impersonatee.roles ?? []),
              ...(result.impersonateeRoles ?? []),
            ],
          }
        : undefined;

    const requesterSession: Session = {
      token,
      issuedAt: DateTime.fromMillis(iat),
      userId: result.userId ?? anon.id,
      anonymous: !result.userId,
      roles: result.roles,
    };

    const session: Session = impersonatee
      ? {
          ...requesterSession,
          userId: impersonatee?.id ?? requesterSession.userId,
          roles: impersonatee.roles,
          impersonator: requesterSession,
          impersonatee,
        }
      : requesterSession;

    if (impersonatee) {
      const allowImpersonation = new Poll();
      await this.sessionHost.withSession(requesterSession, async () => {
        const event = new CanImpersonateEvent(
          requesterSession,
          allowImpersonation,
        );
        await this.events.publish(event);
      });
      if (!(allowImpersonation.plurality && !allowImpersonation.vetoed)) {
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
  lazySessionForRootUser(input?: Partial<Session>) {
    const promiseOfRootId = this.waitForRootUserIdOnce().then((id) => {
      (session as Writable<Session>).userId = id;
      return id;
    });
    const unresolvedId = 'unresolvedId' as ID;
    const session: Session = {
      token: 'system',
      issuedAt: DateTime.now(),
      userId: unresolvedId,
      anonymous: false,
      roles: ['global:Administrator'],
      ...input,
    };
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
              roles: roles.map(rolesForScope('global')),
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

  asRole<R>(role: Role, fn: () => R): R {
    const session: Session = {
      token: 'system',
      issuedAt: DateTime.now(),
      userId: 'anonymous' as ID,
      anonymous: false,
      roles: [`global:${role}`],
    };
    return this.sessionHost.withSession(session, fn);
  }

  async sessionForUser(userId: ID): Promise<Session> {
    const roles = await this.repo.rolesForUser(userId);
    const session: Session = {
      token: 'system',
      issuedAt: DateTime.now(),
      userId,
      anonymous: false,
      roles,
    };
    return session;
  }
}
