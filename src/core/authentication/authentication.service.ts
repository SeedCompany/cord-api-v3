import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { CachedByArg } from '@seedcompany/common';
import { EmailService } from '@seedcompany/nestjs-email';
import JWT from 'jsonwebtoken';
import { DateTime } from 'luxon';
import type { Writable } from 'ts-essentials';
import {
  DuplicateException,
  type ID,
  InputException,
  type Role,
  ServerException,
  type Session,
  UnauthenticatedException,
  UnauthorizedException,
} from '~/common';
import { ConfigService, ILogger, Logger } from '~/core';
import { Privileges } from '../../components/authorization';
import {
  rolesForScope,
  withoutScope,
} from '../../components/authorization/dto';
import { AssignableRoles } from '../../components/authorization/dto/assignable-roles.dto';
import { SystemAgentRepository } from '../../components/user/system-agent.repository';
import { ForgotPassword } from '../email/templates';
import { disableAccessPolicies, Gel } from '../gel';
import { AuthenticationRepository } from './authentication.repository';
import { CryptoService } from './crypto.service';
import type { LoginInput, RegisterInput, ResetPasswordInput } from './dto';
import { NoSessionException } from './session/no-session.exception';
import { SessionHost } from './session/session.host';

interface JwtPayload {
  iat: number;
}

@Injectable()
export class AuthenticationService {
  constructor(
    private readonly config: ConfigService,
    private readonly crypto: CryptoService,
    private readonly email: EmailService,
    private readonly privileges: Privileges,
    @Logger('authentication:service') private readonly logger: ILogger,
    private readonly repo: AuthenticationRepository,
    private readonly gel: Gel,
    private readonly agents: SystemAgentRepository,
    private readonly sessionHost: SessionHost,
    private readonly moduleRef: ModuleRef,
  ) {}

  async createToken(): Promise<string> {
    const token = this.encodeJWT();

    await this.repo.saveSessionToken(token);
    return token;
  }

  async register(
    { password, ...input }: RegisterInput,
    session?: Session,
  ): Promise<ID> {
    // ensure no other tokens are associated with this user
    if (session) {
      await this.logout(session.token);
    }

    let userId;
    try {
      const userMod = await import('../../components/user');
      const users = this.moduleRef.get(userMod.UserService, { strict: false });
      userId = await this.gel.usingOptions(
        disableAccessPolicies,
        async () => await users.create(input),
      );
    } catch (e) {
      // remap field prop as `email` field is at a different location in register() than createPerson()
      if (e instanceof DuplicateException && e.field === 'person.email') {
        throw e.withField('email');
      }
      throw e;
    }

    const passwordHash = await this.crypto.hash(password);
    await this.repo.savePasswordHashOnUser(userId, passwordHash);

    return userId;
  }

  async login(input: LoginInput): Promise<ID> {
    const hash = await this.repo.getPasswordHash(input);

    if (!(await this.crypto.verify(hash, input.password))) {
      throw new UnauthenticatedException('Invalid credentials');
    }

    const userId = await this.repo.connectSessionToUser(
      input,
      this.sessionHost.current,
    );

    if (!userId) {
      throw new ServerException('Login failed');
    }

    return userId;
  }

  async refreshCurrentSession() {
    const prev = this.sessionHost.current;
    const newSession = await this.resumeSession(prev.token);
    this.sessionHost.current$.next(newSession);
    return newSession;
  }

  async logout(token: string): Promise<void> {
    await this.repo.disconnectUserFromSession(token);
  }

  async resumeSession(
    token: string,
    impersonatee?: Session['impersonatee'],
  ): Promise<Session> {
    this.logger.debug('Decoding token', { token });

    const { iat } = this.decodeJWT(token);

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
      const valid = this.sessionHost.withSession(requesterSession, () => {
        const p = this.privileges.for(AssignableRoles);
        return impersonatee.roles.every((role) =>
          p.can('edit', withoutScope(role)),
        );
      });
      if (!valid) {
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

  async changePassword(
    oldPassword: string,
    newPassword: string,
  ): Promise<void> {
    if (!oldPassword)
      throw new InputException('Old Password Required', 'oldPassword');

    const hash = await this.repo.getCurrentPasswordHash();

    if (!(await this.crypto.verify(hash, oldPassword))) {
      throw new UnauthenticatedException('Invalid credentials');
    }

    const newPasswordHash = await this.crypto.hash(newPassword);
    await this.repo.updatePassword(newPasswordHash);

    await this.repo.deactivateAllOtherSessions(this.sessionHost.current);
  }

  async forgotPassword(email: string): Promise<void> {
    const exists = await this.repo.doesEmailAddressExist(email);
    if (!exists) {
      this.logger.warning('Email not found; Skipping reset email', { email });
      return;
    }

    const token = this.encodeJWT();

    await this.repo.saveEmailToken(email, token);
    await this.email.send(email, ForgotPassword, {
      token,
    });
  }

  async resetPassword({ token, password }: ResetPasswordInput): Promise<void> {
    const emailToken = await this.repo.findEmailToken(token);
    if (!emailToken) {
      throw new InputException('Token is invalid', 'TokenInvalid');
    }

    if (emailToken.createdOn.diffNow().as('days') > 1) {
      throw new InputException('Token has expired', 'TokenExpired');
    }

    const pash = await this.crypto.hash(password);

    await this.repo.updatePasswordViaEmailToken(emailToken, pash);
    await this.repo.deactivateAllOtherSessionsByEmail(
      emailToken.email,
      this.sessionHost.current,
    );
    await this.repo.removeAllEmailTokensForEmail(emailToken.email);
  }

  private encodeJWT() {
    const payload: JwtPayload = {
      iat: Date.now(),
    };

    return JWT.sign(payload, this.config.jwtKey);
  }

  private decodeJWT(token?: string) {
    if (!token) {
      throw new UnauthenticatedException();
    }

    try {
      return JWT.verify(token, this.config.jwtKey) as JwtPayload;
    } catch (exception) {
      this.logger.warning('Failed to validate JWT', {
        exception,
      });
      throw new UnauthenticatedException(exception);
    }
  }
}
