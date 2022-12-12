import { Injectable } from '@nestjs/common';
import { EmailService } from '@seedcompany/nestjs-email';
import { sign, verify } from 'jsonwebtoken';
import { DateTime } from 'luxon';
import {
  DuplicateException,
  GqlContextType,
  ID,
  InputException,
  ServerException,
  Session,
  UnauthenticatedException,
} from '../../common';
import { ConfigService, ILogger, Logger } from '../../core';
import { ForgotPassword } from '../../core/email/templates';
import { UserService } from '../user';
import { AuthenticationRepository } from './authentication.repository';
import { CryptoService } from './crypto.service';
import { LoginInput, RegisterInput, ResetPasswordInput } from './dto';
import { NoSessionException } from './no-session.exception';

interface JwtPayload {
  iat: number;
}

@Injectable()
export class AuthenticationService {
  constructor(
    private readonly config: ConfigService,
    private readonly crypto: CryptoService,
    private readonly email: EmailService,
    private readonly userService: UserService,
    @Logger('authentication:service') private readonly logger: ILogger,
    private readonly repo: AuthenticationRepository
  ) {}

  async createToken(): Promise<string> {
    const token = this.encodeJWT();

    await this.repo.saveSessionToken(token);
    return token;
  }

  async register(input: RegisterInput, session?: Session): Promise<ID> {
    // ensure no other tokens are associated with this user
    if (session) {
      await this.logout(session.token);
    }

    let userId;
    try {
      userId = await this.userService.create(input, session);
    } catch (e) {
      // remap field prop as `email` field is at a different location in register() than createPerson()
      if (e instanceof DuplicateException && e.field === 'person.email') {
        throw e.withField('email');
      }
      throw e;
    }

    const passwordHash = await this.crypto.hash(input.password);
    await this.repo.savePasswordHashOnUser(userId, passwordHash);

    return userId;
  }

  async login(input: LoginInput, session: Session): Promise<ID> {
    const hash = await this.repo.getPasswordHash(input, session);

    if (!(await this.crypto.verify(hash, input.password))) {
      throw new UnauthenticatedException('Invalid credentials');
    }

    const userId = await this.repo.connectSessionToUser(input, session);

    if (!userId) {
      throw new ServerException('Login failed');
    }

    return userId;
  }

  async updateSession(context: GqlContextType) {
    if (!context.session) {
      throw new NoSessionException();
    }
    const newSession = await this.resumeSession(context.session.token);
    context.session = newSession; // replace session given with session pipe
    return newSession;
  }

  async logout(token: string): Promise<void> {
    await this.repo.deleteSessionToken(token);
  }

  async resumeSession(
    token: string,
    impersonatee?: Session['impersonatee']
  ): Promise<Session> {
    this.logger.debug('Decoding token', { token });

    const { iat } = this.decodeJWT(token);

    const result = await this.repo.resumeSession(token, impersonatee?.id);

    if (!result) {
      this.logger.debug('Failed to find active token in database', { token });
      throw new NoSessionException(
        'Session has not been established',
        'NoSession'
      );
    }

    impersonatee = impersonatee
      ? {
          id: impersonatee?.id,
          roles: [
            ...(impersonatee.roles ?? []),
            ...(result.impersonateeRoles ?? []),
          ],
        }
      : undefined;

    const requesterSession: Session = {
      token,
      issuedAt: DateTime.fromMillis(iat),
      userId: result.userId ?? ('anonuserid' as ID),
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

    this.logger.debug('Resumed session', session);
    return session;
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

  async changePassword(
    oldPassword: string,
    newPassword: string,
    session: Session
  ): Promise<void> {
    if (!oldPassword)
      throw new InputException('Old Password Required', 'oldPassword');

    const hash = await this.repo.getCurrentPasswordHash(session);

    if (!(await this.crypto.verify(hash, oldPassword))) {
      throw new UnauthenticatedException('Invalid credentials');
    }

    const newPasswordHash = await this.crypto.hash(newPassword);
    await this.repo.updatePassword(newPasswordHash, session);

    await this.repo.deactivateAllOtherSessions(session);
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

  async resetPassword(
    { token, password }: ResetPasswordInput,
    session: Session
  ): Promise<void> {
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
      session
    );
    await this.repo.removeAllEmailTokensForEmail(emailToken.email);
  }

  private encodeJWT() {
    const payload: JwtPayload = {
      iat: Date.now(),
    };

    return sign(payload, this.config.jwtKey);
  }

  private decodeJWT(token?: string) {
    if (!token) {
      throw new UnauthenticatedException();
    }

    try {
      return verify(token, this.config.jwtKey) as JwtPayload;
    } catch (exception) {
      this.logger.warning('Failed to validate JWT', {
        exception,
      });
      throw new UnauthenticatedException(exception);
    }
  }
}
